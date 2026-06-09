import { gunzipSync } from "zlib";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client as s3, secretsClient as sm } from "./aws";
import { fetchKey, decrypt } from "./crypto";
import { createEphemeralDb, dropEphemeralDb } from "./importer";
import { runIntegrityChecks } from "./checks";
import { writeTelemetry, updateNodePing, insertAlert, getNotifyPrefs } from "./telemetry";
import { sendEmail } from "./notifier";

export interface S3EventRecord {
  s3: { bucket: { name: string }; object: { key: string; size: number } };
}

export async function handler(event: { Records: S3EventRecord[] }): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const sizeBytes = record.s3.object.size;

    // Derive node id from key: backups/<nodeId>/<filename>
    const nodeId = key.split("/")[1] ?? "unknown";

    const startTime = Date.now();
    console.log(`[handler] Processing ${key} (${sizeBytes} bytes)`);

    const adminDsn = process.env.EPHEMERAL_DB_ADMIN_DSN!;
    let dbName: string | null = null;
    let adminPool: any = null;

    try {
      // Download encrypted payload from S3
      const s3Resp = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const chunks: Buffer[] = [];
      for await (const chunk of s3Resp.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      const encryptedData = Buffer.concat(chunks);

      // Decrypt in memory (NFR-5: never write to persistent storage)
      const aesKey = await fetchKey(sm, process.env.SECRET_ID!);
      const decrypted = decrypt(aesKey, encryptedData);
      aesKey.fill(0); // zero key from memory

      // Decompress (reverse of the daemon's compress→encrypt order).
      // Detect the gzip magic bytes so pre-compression backups still validate.
      const isGzip = decrypted.length > 1 && decrypted[0] === 0x1f && decrypted[1] === 0x8b;
      const sqlDump = isGzip ? gunzipSync(decrypted) : decrypted;

      // Spin up ephemeral DB and import
      const result = await createEphemeralDb(adminDsn, sqlDump);
      dbName = result.dbName;
      adminPool = result.adminPool;
      sqlDump.fill(0); // zero plaintext from memory
      decrypted.fill(0); // zero the (compressed) intermediate too

      // Run integrity checks
      const { rowCounts, checksum } = await runIntegrityChecks(adminDsn, dbName);

      const latencyMs = Date.now() - startTime;
      console.log(`[handler] PASS ${key} — checksum: ${checksum}, latency: ${latencyMs}ms`);

      await writeTelemetry({
        nodeId,
        s3Key: key,
        status: "pass",
        rowCounts,
        checksum,
        dbSizeBytes: sizeBytes,
        latencyMs,
        validatedAt: new Date(),
      });

      await updateNodePing(nodeId);

      // Phase 3 alerting
      const prefs = await getNotifyPrefs().catch(() => ({ notifyOnFailure: true, notifyOnSuccess: false, latencySlaMs: 2500, alertEmail: null }));
      if (latencyMs > prefs.latencySlaMs) {
        const msg = `Validation latency ${latencyMs}ms exceeded ${prefs.latencySlaMs}ms SLA for ${nodeId}.`;
        await insertAlert("warning", "backup_latency", msg, nodeId).catch(() => {});
        sendEmail(prefs.alertEmail, `[Restora] Latency SLA breach on ${nodeId}`, msg);
      }
      if (prefs.notifyOnSuccess) {
        const msg = `Backup validated for ${nodeId} (checksum ${checksum.slice(0, 8)}).`;
        await insertAlert("info", "backup_success", msg, nodeId).catch(() => {});
        sendEmail(prefs.alertEmail, `[Restora] Backup succeeded on ${nodeId}`, msg);
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`[handler] FAIL ${key}:`, err.message);

      await writeTelemetry({
        nodeId,
        s3Key: key,
        status: "critical_failure",
        latencyMs,
        errorDetail: err.message,
        validatedAt: new Date(),
      }).catch(() => {});

      const prefs = await getNotifyPrefs().catch(() => ({ notifyOnFailure: true, notifyOnSuccess: false, latencySlaMs: 2500, alertEmail: null }));
      if (prefs.notifyOnFailure) {
        const msg = `Backup FAILED for ${nodeId}: ${err.message}`;
        await insertAlert("critical", "backup_failure", msg, nodeId).catch(() => {});
        sendEmail(prefs.alertEmail, `[Restora] CRITICAL: backup failed on ${nodeId}`, msg);
      }
    } finally {
      // Always destroy ephemeral DB (FR-7)
      if (dbName && adminPool) {
        await dropEphemeralDb(adminPool, dbName);
        await adminPool.end().catch(() => {});
        console.log(`[handler] Ephemeral DB ${dbName} destroyed.`);
      }
    }
  }
}
