import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../firebase/config'

export const useDownloadURL = (storagePath) => {
    const [url, setUrl] = useState(null)

    useEffect(() => {
        if (!storagePath) {
            setUrl(null)
            return
        }

        let cancelled = false
        getDownloadURL(ref(storage, storagePath))
            .then((resolvedUrl) => {
                if (!cancelled) setUrl(resolvedUrl)
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [storagePath])

    return url
}
