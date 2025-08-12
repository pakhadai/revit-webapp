// Модуль форм для адміністрування
window.AdminModule = window.AdminModule || {};

// Додаємо функції форм до існуючого модуля
Object.assign(window.AdminModule, {
    // --- ФОРМА СТВОРЕННЯ ТОВАРУ ---
    showCreateForm(app) {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="admin-archive-form p-3">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2>📦 Створити новий товар</h2>
                    <button onclick="AdminModule.showArchives(window.app)" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                </div>

                <form id="archive-form" style="max-width: 600px;">
                    ${this.getFormFields()}

                    <!-- Кнопки -->
                    <div style="display: flex; gap: 15px;">
                        <button type="submit" style="flex: 1; padding: 15px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                            ✅ Створити товар
                        </button>
                        <button type="button" onclick="AdminModule.showArchives(window.app)" style="flex: 1; padding: 15px; background: var(--tg-theme-secondary-bg-color); color: var(--tg-theme-text-color); border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                            ❌ Скасувати
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Обробник форми
        document.getElementById('archive-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createArchive(app);
        });
    },

    // --- ФОРМА РЕДАГУВАННЯ ТОВАРУ ---
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
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2>✏️ Редагувати товар: ${archive.title.ua || archive.code}</h2>
                        <button onclick="AdminModule.showArchives(window.app)" style="padding: 8px 16px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 6px; cursor: pointer;">← Назад</button>
                    </div>

                    <form id="edit-archive-form" style="max-width: 600px;">
                        ${this.getFormFields(archive)}

                        <!-- Статистика -->
                        <div class="form-group" style="margin-bottom: 30px; padding: 15px; background: var(--tg-theme-secondary-bg-color); border-radius: 8px;">
                            <h4 style="margin: 0 0 10px; color: var(--primary-color);">📊 Статистика</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                                <div>Продажів: <strong>${archive.purchase_count}</strong></div>
                                <div>Переглядів: <strong>${archive.view_count}</strong></div>
                            </div>
                            <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 5px;">
                                Створено: ${new Date(archive.created_at).toLocaleDateString('uk-UA')}
                            </div>
                        </div>

                        <!-- Кнопки -->
                        <div style="display: flex; gap: 15px;">
                            <button type="submit" style="flex: 1; padding: 15px; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                💾 Зберегти зміни
                            </button>
                            <button type="button" onclick="AdminModule.showArchives(window.app)" style="flex: 1; padding: 15px; background: var(--tg-theme-secondary-bg-color); color: var(--tg-theme-text-color); border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                                ❌ Скасувати
                            </button>
                        </div>
                    </form>
                </div>
            `;

            // Обробник форми редагування
            document.getElementById('edit-archive-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateArchive(app, archiveId);
            });

        } catch (error) {
            console.error('Edit archive error:', error);
            alert('❌ Помилка завантаження товару: ' + error.message);
        }
    },

    // --- ГЕНЕРАЦІЯ ПОЛІВ ФОРМИ ---
    getFormFields(archive = null) {
        const isEdit = !!archive;
        const prefix = isEdit ? 'edit_' : '';

        // Заповнюємо дані для редагування, якщо вони є
        setTimeout(() => {
            if(isEdit && archive) {
                // Заповнення шляхів до зображень і файлу для редагування
                if (archive.image_paths && archive.image_paths.length > 0) {
                    const hiddenImagesInput = document.getElementById('image_paths_hidden');
                    if(hiddenImagesInput) {
                        hiddenImagesInput.value = JSON.stringify(archive.image_paths);
                        window.AdminUploadModule.uploadedImages = archive.image_paths;
                        window.AdminUploadModule.updateImagePreview();
                    }
                }
                if (archive.file_path) {
                     const hiddenFileInput = document.getElementById('file_path_hidden');
                     const hiddenFileSizeInput = document.getElementById('file_size_hidden');
                     const statusDiv = document.getElementById('archive-status');
                     if(hiddenFileInput) hiddenFileInput.value = archive.file_path;
                     if(hiddenFileSizeInput) hiddenFileSizeInput.value = archive.file_size;
                     if(statusDiv) statusDiv.innerHTML = `✅ ${archive.file_path.split('/').pop()} (${(archive.file_size/1024/1024).toFixed(2)} MB)`;
                }
            }
        }, 0);


        return `
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Код товару *</label>
                <input type="text" id="${prefix}code" required value="${archive ? archive.code : ''}" placeholder="Наприклад: pack_01_2025" ${isEdit ? 'readonly' : ''} style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px; ${isEdit ? 'background: #f0f0f0;' : ''}">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Назва (українською) *</label>
                <input type="text" id="${prefix}title_ua" required value="${archive ? (archive.title.ua || '') : ''}" placeholder="Наприклад: Двері та вікна" style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
            </div>
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Опис (українською) *</label>
                <textarea id="${prefix}description_ua" required rows="3" placeholder="Детальний опис товару українською мовою" style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px; resize: vertical;">${archive ? (archive.description.ua || '') : ''}</textarea>
            </div>
             <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">📸 Зображення товару</label>
                <div id="image-drop-zone"
                     ondrop="AdminUploadModule.handleDrop(event)"
                     ondragover="AdminUploadModule.handleDragOver(event)"
                     ondragleave="AdminUploadModule.handleDragLeave(event)"
                     style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; transition: background-color 0.2s, border-color 0.2s;">
                    <input type="file" id="images-upload" multiple accept="image/*" style="display: none;" onchange="AdminUploadModule.handleFileSelect(this.files)">
                    <p style="color: var(--tg-theme-hint-color); margin:0 0 15px;">Перетягніть файли сюди або</p>
                    <button type="button" onclick="document.getElementById('images-upload').click()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📷 Вибрати фото
                    </button>
                    <div id="images-preview" style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;"></div>
                </div>
                <input type="hidden" id="image_paths_hidden" value="${isEdit && archive ? JSON.stringify(archive.image_paths) : '[]'}">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">📦 Файл архіву</label>
                 <div style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center;">
                    <input type="file" id="archive-upload" accept=".zip,.rar,.7z" style="display: none;" onchange="AdminUploadModule.uploadArchiveFile(this)">
                    <button type="button" onclick="document.getElementById('archive-upload').click()" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        📁 Вибрати архів
                    </button>
                    <div id="archive-upload-progress-container" style="display: none; margin-top: 15px;">
                        <div id="archive-status" style="font-size: 14px; margin-bottom: 5px;"></div>
                        <div style="background-color: #e0e0e0; border-radius: 5px; overflow: hidden;">
                            <div id="archive-progress-bar" style="width: 0%; height: 10px; background-color: var(--primary-color); transition: width 0.3s;"></div>
                        </div>
                    </div>
                </div>
                <input type="hidden" id="file_path_hidden" value="${isEdit && archive ? archive.file_path : ''}">
                <input type="hidden" id="file_size_hidden" value="${isEdit && archive ? archive.file_size : ''}">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="form-group">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Ціна (USD) *</label>
                    <input type="number" id="${prefix}price" required min="0" step="0.01" value="${archive ? archive.price : '9.99'}" style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                </div>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Знижка (%)</label>
                    <input type="number" id="${prefix}discount_percent" min="0" max="99" value="${archive ? archive.discount_percent : '0'}" style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                </div>
            </div>
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Тип товару *</label>
                <select id="${prefix}archive_type" required style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                    <option value="premium" ${archive && archive.archive_type === 'premium' ? 'selected' : ''}>💎 Premium</option>
                    <option value="free" ${archive && archive.archive_type === 'free' ? 'selected' : ''}>📦 Безкоштовний</option>
                </select>
            </div>
        `;
    },

// --- ЗБІР ДАНИХ З ФОРМИ (ДОПОМІЖНА ФУНКЦІЯ)---
    _getFormData(prefix = '') {
        const title_ua = document.getElementById(prefix + 'title_ua')?.value.trim();
        const description_ua = document.getElementById(prefix + 'description_ua')?.value.trim();

        const formData = {
            code: document.getElementById(prefix + 'code')?.value.trim(),
            title: {
                ua: title_ua,
                en: document.getElementById(prefix + 'title_en')?.value.trim() || title_ua
            },
            description: {
                ua: description_ua,
                en: document.getElementById(prefix + 'description_en')?.value.trim() || description_ua
            },
            price: parseFloat(document.getElementById(prefix + 'price')?.value),
            discount_percent: parseInt(document.getElementById(prefix + 'discount_percent')?.value) || 0,
            archive_type: document.getElementById(prefix + 'archive_type')?.value,
            image_paths: JSON.parse(document.getElementById(prefix + 'image_paths_hidden')?.value || '[]'),
            file_path: document.getElementById(prefix + 'file_path_hidden')?.value,
            file_size: parseInt(document.getElementById(prefix + 'file_size_hidden')?.value || 0)
        };

        // Валідація
        if (!formData.code || !formData.title.ua || !formData.description.ua || isNaN(formData.price)) {
            throw new Error('Будь ласка, заповніть всі обов\'язкові поля: Код, Назва (укр), Опис (укр), Ціна.');
        }

        return formData;
    },

    // --- СТВОРЕННЯ ТОВАРУ ---
    async createArchive(app) {
        try {
            const formData = this._getFormData(); // Використовуємо без префікса
            const response = await app.api.post('/api/admin/archives', formData);

            if (response.success) {
                alert('✅ Товар успішно створено!');
                this.showArchives(app);
            }
        } catch (error) {
            console.error('Create archive error:', error);
            alert('❌ Помилка створення товару: ' + error.message);
        }
    },

    // --- ОНОВЛЕННЯ ТОВАРУ (З ВИПРАВЛЕННЯМ) ---
    async updateArchive(app, archiveId) {
        try {
            const formData = this._getFormData('edit_'); // Використовуємо префікс 'edit_'
            const response = await app.api.put(`/api/admin/archives/${archiveId}`, formData);

            if (response.success) {
                alert('✅ Товар успішно оновлено!');
                this.showArchives(app);
            }
        } catch (error) {
            console.error('Update archive error:', error);
            alert('❌ Помилка оновлення товару: ' + error.message);
        }
    },

    // --- ВИДАЛЕННЯ ТОВАРУ ---
    async deleteArchive(app, id) {
        try {
            const archives = await app.api.get('/api/admin/archives');
            const archive = archives.find(a => a.id === id);
            const archiveName = archive ? (archive.title.ua || archive.code) : `ID ${id}`;

            if (confirm(`Ви впевнені що хочете видалити товар "${archiveName}"?\n\nЦю дію не можна скасувати!`)) {
                try {
                    await app.api.delete(`/api/admin/archives/${id}`);
                    alert('✅ Товар успішно видалено!');
                    this.showArchives(app);
                } catch (error) {
                    alert(`❌ Помилка видалення: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('Delete archive error:', error);
            alert(`❌ Помилка: ${error.message}`);
        }
    }
});
