import { getPool } from "../db/pool";
import { emailAlert } from "../lib/notifier";

const STALE_MINUTES = 5;
const SWEEP_INTERVAL_MS = 60_000;
// Cluster-wide lock id so only one API replica runs a given sweep tick.
const SWEEP_LOCK_KEY = 472_910;

/**
 * Periodically flags connected nodes that have stopped reporting (no ping for
 * STALE_MINUTES) as disconnected and raises a warning alert for each transition.
 * Recovery (back to connected) is handled by the validator on the next ping.
 */
export function startStaleSweep() {
  const run = async () => {
    const pool = getPool();
    // Only one replica wins the lock per tick — prevents duplicate alerts when
    // the API is scaled horizontally. Others skip this tick cleanly.
    const lock = await pool.query<{ ok: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS ok`,
      [SWEEP_LOCK_KEY]
    );
    if (!lock.rows[0]?.ok) return;

    try {
      const stale = await pool.query(
        `UPDATE nodes
            SET status = 'node_disconnected'
          WHERE status = 'connected'
            AND COALESCE(last_ping, created_at) < now() - ($1 || ' minutes')::interval
        RETURNING node_id`,
        [STALE_MINUTES]
      );
      for (const row of stale.rows) {
        const msg = `Node ${row.node_id} has not reported in over ${STALE_MINUTES} minutes — marked disconnected.`;
        await pool.query(
          `INSERT INTO alerts (severity, type, node_id, message)
           VALUES ('warning', 'node_stale', $1, $2)`,
          [row.node_id, msg]
        );
        emailAlert(`[Restora] Node ${row.node_id} disconnected`, msg);
        console.log(`[sweep] node ${row.node_id} marked stale`);
      }
    } catch (err: any) {
      console.error("[sweep] error:", err.message);
    } finally {
      await pool.query(`SELECT pg_advisory_unlock($1)`, [SWEEP_LOCK_KEY]).catch(() => {});
    }
  };
  run();
  setInterval(run, SWEEP_INTERVAL_MS);
}
