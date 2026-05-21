// --- GESTOR INDEXEDDB NATIVO ---
const db = {
    instance: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ArchivoHistoricoDB', 1);
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                if (!database.objectStoreNames.contains('records')) {
                    database.createObjectStore('records', { keyPath: 'pathKey' });
                }
            };
            request.onsuccess = (e) => {
                this.instance = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async put(pathKey, data) {
        return new Promise((resolve) => {
            const tx = this.instance.transaction('records', 'readwrite');
            tx.objectStore('records').put({ pathKey, ...data });
            tx.oncomplete = resolve;
        });
    },
    async get(pathKey) {
        return new Promise((resolve) => {
            if (!this.instance) return resolve(null);
            try {
                const tx = this.instance.transaction('records', 'readonly');
                const request = tx.objectStore('records').get(pathKey);
                request.onsuccess = (e) => resolve(e.target.result ? e.target.result : null);
                request.onerror = () => resolve(null);
            } catch(err) {
                resolve(null);
            }
        });
    },
    async putBulk(recordsObj) {
        return new Promise((resolve) => {
            const tx = this.instance.transaction('records', 'readwrite');
            const store = tx.objectStore('records');
            for (const pathKey in recordsObj) {
                store.put({ pathKey, ...recordsObj[pathKey] });
            }
            tx.oncomplete = resolve;
        });
    },
    async getAll() {
        return new Promise((resolve) => {
            const tx = this.instance.transaction('records', 'readonly');
            const request = tx.objectStore('records').getAll();
            request.onsuccess = (e) => {
                const resultObj = {};
                e.target.result.forEach(item => {
                    const { pathKey, ...data } = item;
                    resultObj[pathKey] = data;
                });
                resolve(resultObj);
            };
        });
    }
};
