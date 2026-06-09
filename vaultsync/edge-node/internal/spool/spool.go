package spool

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Entry is a pending encrypted payload on disk.
type Entry struct {
	Path string
	Key  string // S3 object key derived from filename
}

// Write saves the encrypted payload to the spool directory and returns the entry.
func Write(dir string, nodeID string, data []byte) (*Entry, error) {
	ts := time.Now().UTC().Format("20060102T150405Z")
	filename := fmt.Sprintf("%s_%s.enc", nodeID, ts)
	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return nil, fmt.Errorf("spool write: %w", err)
	}
	return &Entry{Path: path, Key: fmt.Sprintf("backups/%s/%s", nodeID, filename)}, nil
}

// Delete removes a successfully uploaded spool entry.
func Delete(path string) error {
	return os.Remove(path)
}

// List returns all pending spool entries in the directory.
func List(dir string) ([]Entry, error) {
	entries, err := filepath.Glob(filepath.Join(dir, "*.enc"))
	if err != nil {
		return nil, err
	}
	result := make([]Entry, 0, len(entries))
	for _, p := range entries {
		base := filepath.Base(p)
		// Reconstruct node id from filename: <nodeID>_<ts>.enc
		// We store the full relative key; for retry we derive it from path.
		result = append(result, Entry{
			Path: p,
			Key:  fmt.Sprintf("backups/%s", base),
		})
	}
	return result, nil
}

// DiskUsagePercent returns the percentage of used disk space for the dir's filesystem.
// Returns 0 if it cannot be determined (non-Linux).
func DiskUsagePercent(dir string) float64 {
	return diskUsagePercent(dir)
}
