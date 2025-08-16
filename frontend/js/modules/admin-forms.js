// === Адмінський модуль для архівів ===
window.AdminModule = window.AdminModule || {};

Object.assign(window.AdminModule, {
    // --- ФОРМА СТВОРЕННЯ ---
    showCreateForm(app) {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="admin-archive-form p-3">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2>📦 Створити новий товар</h2>
                    <button onclick="AdminModule.showArchives(window.app)" class="back-btn">← Назад</button>
                </div>

                <form id="archive-form" style="max-width: 600px;">
                    ${this.getFormFields()}
                    ${this.getUploadSection()}

                    <div class="form-actions">
                        <button type="submit" class="btn-primary">✅ Створити товар</button>
                        <button type="button" onclick="AdminModule.showArchives(window.app)" class="btn-secondary">❌ Скасувати</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('archive-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createArchive(app);
        });
    },

    // --- ФОРМА РЕДАГУВАННЯ ---
    async showEditForm(app, archiveId) {
        try {
            const archives = await app.api.get('/api/admin/archives');
            const archive = archives.find(a => a.id === archiveId);

            if (!archive) {
                alert('Товар не знайдено');
                return;
            }

            const content = document.getElementById('app-content');
            content.innerHTML = `
                <div class="admin-archive-form p-3">
                    <div class="header">
                        <h2>✏️ Редагувати товар: ${archive.title.ua || archive.code}</h2>
                        <button onclick="AdminModule.showArchives(window.app)" class="back-btn">← Назад</button>
                    </div>

                    <form id="edit-archive-form" style="max-width: 600px;">
                        ${this.getFormFields(archive)}
                        ${this.getUploadSection(archive)}

                        <div class="form-actions">
                            <button type="submit" class="btn-primary">💾 Зберегти зміни</button>
                            <button type="button" onclick="AdminModule.showArchives(window.app)" class="btn-secondary">❌ Скасувати</button>
                        </div>
                    </form>
                </div>
            `;

            document.getElementById('edit-archive-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateArchive(app, archiveId);
            });

            this.loadUploads(archive);

        } catch (error) {
            alert('❌ Помилка завантаження товару: ' + error.message);
        }
    },

    // --- ПОЛЯ ФОРМИ ---
    getFormFields(archive = null) {
        const isEdit = !!archive;
        const prefix = isEdit ? 'edit_' : '';

        return `
            <div class="form-group">
                <label>Код товару *</label>
                <input type="text" id="${prefix}code" required value="${archive ? archive.code : ''}" ${isEdit ? 'readonly' : ''}>
            </div>

            <div class="form-group">
                <label>Назва (ua) *</label>
                <input type="text" id="${prefix}title_ua" required value="${archive ? (archive.title.ua || '') : ''}">
            </div>
            <div class="form-group">
                <label>Назва (en) *</label>
                <input type="text" id="${prefix}title_en" required value="${archive ? (archive.title.en || '') : ''}">
            </div>

            <div class="form-group">
                <label>Опис (ua) *</label>
                <textarea id="${prefix}description_ua" required>${archive ? (archive.description.ua || '') : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Опис (en)</label>
                <textarea id="${prefix}description_en">${archive ? (archive.description.en || '') : ''}</textarea>
            </div>

            <div class="form-group">
                <label>Ціна (USD) *</label>
                <input type="number" id="${prefix}price" required min="0" step="0.01" value="${archive ? archive.price : '9.99'}">
            </div>

            <div class="form-group">
                <label>Тип товару *</label>
                <select id="${prefix}archive_type" required>
                    <option value="premium" ${archive && archive.archive_type === 'premium' ? 'selected' : ''}>💎 Premium</option>
                    <option value="free" ${archive && archive.archive_type === 'free' ? 'selected' : ''}>📦 Free</option>
                </select>
            </div>

            <div class="form-group">
                <label>Активний *</label>
                <select id="${prefix}is_active" required>
                    <option value="true" ${(archive && archive.is_active) ? 'selected' : ''}>Так</option>
                    <option value="false" ${archive && !archive.is_active ? 'selected' : ''}>Ні</option>
                </select>
            </div>
        `;
    },

    // --- СЕКЦІЯ ЗАВАНТАЖЕННЯ ---
    getUploadSection(archive = null) {
        return `
            <div class="upload-section">
                <h3>📂 Файли</h3>
                <input type="file" id="archive_file" accept=".zip">
                <button type="button" onclick="AdminModule.uploadFile(window.app, '${archive ? archive.id : ''}')">⬆️ Завантажити архів</button>

                <div id="archive-file-list"></div>

                <h3>🖼️ Зображення</h3>
                <input type="file" id="archive_image" accept="image/*">
                <button type="button" onclick="AdminModule.uploadImage(window.app, '${archive ? archive.id : ''}')">⬆️ Завантажити зображення</button>

                <div id="archive-image-list"></div>
            </div>
        `;
    },

    // --- ЗАВАНТАЖЕННЯ ФАЙЛУ ---
    async uploadFile(app, archiveId) {
        const fileInput = document.getElementById('archive_file');
        if (!fileInput.files.length) return alert('Оберіть архів');

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            await app.api.post(`/api/admin/archives/${archiveId}/upload/file`, formData, true);
            alert('✅ Архів завантажено');
            this.loadUploads({id: archiveId});
        } catch (err) {
            alert('❌ Помилка завантаження файлу');
        }
    },

    // --- ЗАВАНТАЖЕННЯ ЗОБРАЖЕННЯ ---
    async uploadImage(app, archiveId) {
        const fileInput = document.getElementById('archive_image');
        if (!fileInput.files.length) return alert('Оберіть зображення');

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            await app.api.post(`/api/admin/archives/${archiveId}/upload/image`, formData, true);
            alert('✅ Зображення завантажено');
            this.loadUploads({id: archiveId});
        } catch (err) {
            alert('❌ Помилка завантаження зображення');
        }
    },

    // --- ВІДОБРАЖЕННЯ СПИСКУ ЗАВАНТАЖЕНЬ ---
    async loadUploads(archive) {
        try {
            const filesList = document.getElementById('archive-file-list');
            const imagesList = document.getElementById('archive-image-list');
            if (!filesList || !imagesList) return;

            const uploads = await window.app.api.get(`/api/admin/archives/${archive.id}/uploads`);

            filesList.innerHTML = uploads.files.map(f => `
                <div class="upload-item">
                    <a href="${f.url}" target="_blank">${f.name}</a>
                    <button onclick="AdminModule.removeUpload(window.app, '${archive.id}', '${f.id}')">🗑️</button>
                </div>
            `).join('');

            imagesList.innerHTML = uploads.images.map(img => `
                <div class="upload-item">
                    <img src="${img.url}" style="max-height: 60px;">
                    <button onclick="AdminModule.removeUpload(window.app, '${archive.id}', '${img.id}')">🗑️</button>
                </div>
            `).join('');

        } catch (err) {
            console.error('Load uploads error', err);
        }
    },

    // --- ВИДАЛЕННЯ ФАЙЛУ ---
    async removeUpload(app, archiveId, uploadId) {
        try {
            await app.api.delete(`/api/admin/archives/${archiveId}/uploads/${uploadId}`);
            alert('✅ Видалено');
            this.loadUploads({id: archiveId});
        } catch (err) {
            alert('❌ Помилка видалення');
        }
    },

    // --- ЗБІР ДАНИХ З ФОРМИ ---
    _getFormData(prefix = '') {
        return {
            code: document.getElementById(prefix + 'code')?.value.trim(),
            title: {
                ua: document.getElementById(prefix + 'title_ua')?.value.trim(),
                en: document.getElementById(prefix + 'title_en')?.value.trim()
            },
            description: {
                ua: document.getElementById(prefix + 'description_ua')?.value.trim(),
                en: document.getElementById(prefix + 'description_en')?.value.trim()
            },
            price: parseFloat(document.getElementById(prefix + 'price')?.value),
            archive_type: document.getElementById(prefix + 'archive_type')?.value,
            is_active: document.getElementById(prefix + 'is_active')?.value === 'true'
        };
    },

    // --- СТВОРЕННЯ ---
    async createArchive(app) {
        try {
            const archiveData = this._getFormData('');
            const response = await app.api.post('/api/admin/archives', archiveData);
            if (response.success || response.archive_id) {
                alert('✅ Товар створено!');
                this.showArchives(app);
            }
        } catch (err) {
            alert('❌ Помилка створення: ' + err.message);
        }
    },

    // --- ОНОВЛЕННЯ ---
    async updateArchive(app, archiveId) {
        try {
            const data = this._getFormData('edit_');
            const response = await app.api.put(`/api/admin/archives/${archiveId}`, data);
            if (response.success) {
                alert('✅ Товар оновлено!');
                this.showArchives(app);
            }
        } catch (err) {
            alert('❌ Помилка оновлення: ' + err.message);
        }
    },

    // --- ВИДАЛЕННЯ ---
    async deleteArchive(app, id) {
        try {
            if (confirm(`Видалити товар ID ${id}?`)) {
                await app.api.delete(`/api/admin/archives/${id}`);
                alert('✅ Видалено!');
                this.showArchives(app);
            }
        } catch (err) {
            alert('❌ Помилка видалення: ' + err.message);
        }
    }
});
