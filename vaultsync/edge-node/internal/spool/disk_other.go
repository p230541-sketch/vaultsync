//go:build !linux

package spool

func diskUsagePercent(dir string) float64 {
	return 0
}
