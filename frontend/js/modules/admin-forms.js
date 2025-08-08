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

        return `
            <!-- Код товару -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Код товару *</label>
                <input type="text" id="${prefix}code" required
                       value="${archive ? archive.code : ''}"
                       placeholder="Наприклад: pack_01_2025"
                       ${isEdit ? 'readonly' : ''}
                       style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px; ${isEdit ? 'background: #f5f5f5;' : ''}">
                ${!isEdit ? '<small style="color: var(--tg-theme-hint-color);">Унікальний код для ідентифікації товару</small>' : ''}
            </div>

            <!-- Назва українською -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Назва (українською) *</label>
                <input type="text" id="${prefix}title_ua" required
                       value="${archive ? (archive.title.ua || '') : ''}"
                       placeholder="Наприклад: Двері та вікна"
                       style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
            </div>

            <!-- Назва англійською -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Назва (англійською)</label>
                <input type="text" id="${prefix}title_en"
                       value="${archive ? (archive.title.en || '') : ''}"
                       placeholder="Наприклад: Doors and Windows"
                       style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
            </div>

            <!-- Опис українською -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Опис (українською) *</label>
                <textarea id="${prefix}description_ua" required rows="3"
                          placeholder="Детальний опис товару українською мовою"
                          style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px; resize: vertical;">${archive ? (archive.description.ua || '') : ''}</textarea>
            </div>

            <!-- Опис англійською -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Опис (англійською)</label>
                <textarea id="${prefix}description_en" rows="3"
                          placeholder="Product description in English"
                          style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px; resize: vertical;">${archive ? (archive.description.en || '') : ''}</textarea>
            </div>

            <!-- Ціна і знижка -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="form-group">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Ціна (USD) *</label>
                    <input type="number" id="${prefix}price" required min="0" step="0.01"
                           value="${archive ? archive.price : '9.99'}"
                           style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                </div>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Знижка (%)</label>
                    <input type="number" id="${prefix}discount_percent" min="0" max="99"
                           value="${archive ? archive.discount_percent : '0'}"
                           style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                </div>
            </div>

            <!-- Тип архіву -->
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Тип товару *</label>
                <select id="${prefix}archive_type" required
                        style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                    <option value="premium" ${archive && archive.archive_type === 'premium' ? 'selected' : ''}>💎 Premium</option>
                    <option value="free" ${archive && archive.archive_type === 'free' ? 'selected' : ''}>📦 Безкоштовний</option>
                </select>
            </div>

            <!-- URL зображення -->
            <div class="form-group" style="margin-bottom: 30px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">URL зображення</label>
                <input type="url" id="${prefix}image_path"
                       value="${archive ? (archive.image_path || '') : ''}"
                       placeholder="https://example.com/image.jpg або залиш порожнім"
                       style="width: 100%; padding: 12px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 8px; font-size: 16px;">
                <small style="color: var(--tg-theme-hint-color);">Якщо порожньо, буде використано стандартне зображення</small>
            </div>
        `;
    },

    // --- СТВОРЕННЯ ТОВАРУ ---
    async createArchive(app) {
        try {
            const formData = {
                code: document.getElementById('code').value.trim(),
                title: {
                    ua: document.getElementById('title_ua').value.trim(),
                    en: document.getElementById('title_en').value.trim() || document.getElementById('title_ua').value.trim()
                },
                description: {
                    ua: document.getElementById('description_ua').value.trim(),
                    en: document.getElementById('description_en').value.trim() || document.getElementById('description_ua').value.trim()
                },
                price: parseFloat(document.getElementById('price').value),
                discount_percent: parseInt(document.getElementById('discount_percent').value) || 0,
                archive_type: document.getElementById('archive_type').value,
                image_path: document.getElementById('image_path').value.trim() || '/images/placeholder.png'
            };

            // Валідація
            if (!formData.code || !formData.title.ua || !formData.description.ua || !formData.price) {
                alert('Будь ласка, заповніть всі обов\'язкові поля');
                return;
            }

            const response = await app.api.post('/api/admin/archives', formData);

            if (response.success) {
                alert('✅ Товар успішно створено!');
                this.showArchives(app);
            } else {
                alert('❌ Помилка створення: ' + (response.message || 'Невідома помилка'));
            }

        } catch (error) {
            console.error('Create archive error:', error);
            alert('❌ Помилка створення товару: ' + error.message);
        }
    },

    // --- ОНОВЛЕННЯ ТОВАРУ ---
    async updateArchive(app, archiveId) {
        try {
            const formData = {
                title: {
                    ua: document.getElementById('edit_title_ua').value.trim(),
                    en: document.getElementById('edit_title_en').value.trim() || document.getElementById('edit_title_ua').value.trim()
                },
                description: {
                    ua: document.getElementById('edit_description_ua').value.trim(),
                    en: document.getElementById('edit_description_en').value.trim() || document.getElementById('edit_description_ua').value.trim()
                },
                price: parseFloat(document.getElementById('edit_price').value),
                discount_percent: parseInt(document.getElementById('edit_discount_percent').value) || 0,
                archive_type: document.getElementById('edit_archive_type').value,
                image_path: document.getElementById('edit_image_path').value.trim() || '/images/placeholder.png'
            };

            // Валідація
            if (!formData.title.ua || !formData.description.ua || !formData.price) {
                alert('Будь ласка, заповніть всі обов\'язкові поля');
                return;
            }

            const response = await app.api.put(`/api/admin/archives/${archiveId}`, formData);

            if (response.success) {
                alert('✅ Товар успішно оновлено!');
                this.showArchives(app);
            } else {
                alert('❌ Помилка оновлення: ' + (response.message || 'Невідома помилка'));
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
