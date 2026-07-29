// Renders a logged set from whichever fields it actually carries, which is the
// `fields` array its exercise declares in the repository.
export const formatSet = (set) => {
    const weight = set.weightKg ?? null
    const parts = []

    if (set.reps != null) parts.push(`${set.reps} reps`)
    if (weight != null && weight !== 0) parts.push(`${weight} kg`)
    if (set.durationSeconds != null) parts.push(formatDuration(set.durationSeconds))
    if (set.distanceMeters != null) parts.push(formatDistance(set.distanceMeters))

    if (parts.length === 0) return '-'
    // "12 reps x 60 kg" reads better than a comma list for the common weighted case.
    return set.reps != null && weight != null && weight !== 0 ? parts.join(' × ') : parts.join(' · ')
}

export const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

export const formatDistance = (metres) =>
    metres >= 1000 ? `${(metres / 1000).toFixed(metres % 1000 === 0 ? 0 : 2)} km` : `${metres} m`
