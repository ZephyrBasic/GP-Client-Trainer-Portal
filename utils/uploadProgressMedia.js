import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '../firebase/config'

// type: 'photo' | 'video'. onProgress receives a 0-1 fraction.
export const uploadProgressMedia = ({ uri, type, clientId, caption, onProgress }) => {
    return new Promise((resolve, reject) => {
        ;(async () => {
            try {
                const response = await fetch(uri)
                const blob = await response.blob()

                const mediaRef = doc(collection(db, 'progressMedia'))
                const storagePath = `progressMedia/${clientId}/${mediaRef.id}`
                const storageRef = ref(storage, storagePath)

                const uploadTask = uploadBytesResumable(storageRef, blob)
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0)
                    },
                    (error) => reject(error),
                    async () => {
                        try {
                            await setDoc(mediaRef, {
                                clientId,
                                type,
                                storagePath,
                                caption: caption?.trim() || '',
                                createdAt: serverTimestamp(),
                            })
                            resolve(mediaRef.id)
                        } catch (err) {
                            reject(err)
                        }
                    }
                )
            } catch (err) {
                reject(err)
            }
        })()
    })
}
