// frontend/js/modules/admin-upload-enhanced.js
/**
 * Розширений модуль завантаження файлів з Drag & Drop та превью
 * Замініть admin-upload.js цим файлом
 */

window.AdminUploadEnhanced = {
    uploadedImages: [],
    uploadedArchive: null,
    currentArchiveId: null,

    // Ініціалізація модуля
    init() {
        this.setupEventListeners();
        this.loadSavedState();
    },

    setupEventListeners() {
        // Глобальні слухачі для drag & drop
        document.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
            }
        });

        document.addEventListener('drop', (e) => {
            if (!e.target.closest('.drop-zone')) {
                e.preventDefault();
            }
        });
    },

    loadSavedState() {
        // Відновлюємо стан з sessionStorage
        const saved = sessionStorage.getItem('upload_state');
        if (saved) {
            const state = JSON.parse(saved);
            this.uploadedImages = state.images || [];
            this.uploadedArchive = state.archive || null;
        }
    },

    saveState() {
        // Зберігаємо стан
        sessionStorage.setItem('upload_state', JSON.stringify({
            images: this.uploadedImages,
            archive: this.uploadedArchive
        }));
    },

    // ===== СТВОРЕННЯ UI КОМПОНЕНТІВ =====

    createImageUploadZone() {
        return `
            <div class="upload-zone image-upload-zone" id="image-upload-zone">
                <div class="drop-zone"
                     ondrop="AdminUploadEnhanced.handleImageDrop(event)"
                     ondragover="AdminUploadEnhanced.handleDragOver(event)"
                     ondragleave="AdminUploadEnhanced.handleDragLeave(event)"
                     ondragenter="AdminUploadEnhanced.handleDragEnter(event)">

                    <div class="drop-zone-content">
                        <div class="drop-icon">📸</div>
                        <h3>Перетягніть фото сюди</h3>
                        <p>або</p>
                        <input type="file"
                               id="image-file-input"
                               multiple
                               accept="image/*"
                               style="display: none;"
                               onchange="AdminUploadEnhanced.handleImageSelect(this.files)">
                        <button class="btn btn-primary"
                                onclick="document.getElementById('image-file-input').click()">
                            Виберіть файли
                        </button>
                        <p class="hint">Максимум 10 фото, до 10MB кожне</p>
                        <p class="formats">JPG, PNG, WebP, GIF</p>
                    </div>

                    <div class="upload-progress" id="image-upload-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="image-progress-fill"></div>
                        </div>
                        <div class="progress-text" id="image-progress-text">Завантаження...</div>
                    </div>
                </div>

                <div class="uploaded-images" id="uploaded-images-grid">
                    <!-- Тут будуть завантажені зображення -->
                </div>
            </div>
        `;
    },

    createArchiveUploadZone() {
        return `
            <div class="upload-zone archive-upload-zone" id="archive-upload-zone">
                <div class="drop-zone"
                     ondrop="AdminUploadEnhanced.handleArchiveDrop(event)"
                     ondragover="AdminUploadEnhanced.handleDragOver(event)"
                     ondragleave="AdminUploadEnhanced.handleDragLeave(event)"
                     ondragenter="AdminUploadEnhanced.handleDragEnter(event)">

                    <div class="drop-zone-content" id="archive-drop-content">
                        <div class="drop-icon">📦</div>
                        <h3>Перетягніть архів сюди</h3>
                        <p>або</p>
                        <input type="file"
                               id="archive-file-input"
                               accept=".zip,.rar,.7z"
                               style="display: none;"
                               onchange="AdminUploadEnhanced.handleArchiveSelect(this.files)">
                        <button class="btn btn-secondary"
                                onclick="document.getElementById('archive-file-input').click()">
                            Виберіть файл
                        </button>
                        <p class="hint">Максимум 100MB</p>
                        <p class="formats">ZIP, RAR, 7Z</p>
                    </div>

                    <div class="upload-progress" id="archive-upload-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="archive-progress-fill"></div>
                        </div>
                        <div class="progress-text" id="archive-progress-text">Завантаження...</div>
                    </div>

                    <div class="archive-info" id="archive-info" style="display: none;">
                        <div class="file-icon">📄</div>
                        <div class="file-details">
                            <div class="file-name" id="archive-file-name"></div>
                            <div class="file-size" id="archive-file-size"></div>
                            <button class="btn-remove" onclick="AdminUploadEnhanced.removeArchive()">
                                ❌ Видалити
                            </button>
                        </div>
                        <button class="btn-preview" onclick="AdminUploadEnhanced.showArchivePreview()">
                            👁️ Превью
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ===== DRAG & DROP HANDLERS =====

    handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    },

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(e) {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    },

    handleImageDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files).filter(f =>
            f.type.startsWith('image/')
        );

        if (files.length > 0) {
            this.handleImageSelect(files);
        }
    },

    handleArchiveDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files).filter(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ['zip', 'rar', '7z'].includes(ext);
        });

        if (files.length > 0) {
            this.handleArchiveSelect(files);
        }
    },

    // ===== ОБРОБКА ФАЙЛІВ =====

    async handleImageSelect(files) {
        const fileArray = Array.from(files);

        // Перевірка кількості
        if (this.uploadedImages.length + fileArray.length > 10) {
            alert('⚠️ Максимум 10 зображень для одного товару');
            return;
        }

        // Валідація розміру
        const oversized = fileArray.filter(f => f.size > 10 * 1024 * 1024);
        if (oversized.length > 0) {
            alert(`⚠️ Файли занадто великі: ${oversized.map(f => f.name).join(', ')}`);
            return;
        }

        // Показуємо прогрес
        this.showImageProgress(true);

        try {
            const formData = new FormData();
            fileArray.forEach(file => formData.append('files', file));
            if (this.currentArchiveId) {
                formData.append('archive_id', this.currentArchiveId);
            }

            const response = await this.uploadWithProgress(
                '/api/uploads/images/batch',
                formData,
                (progress) => this.updateImageProgress(progress)
            );

            if (response.success) {
                // Додаємо нові зображення
                this.uploadedImages.push(...response.uploaded);
                this.renderUploadedImages();
                this.saveState();

                if (response.errors.length > 0) {
                    alert(`⚠️ Деякі файли не вдалось завантажити:\n${response.errors.join('\n')}`);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`❌ Помилка завантаження: ${error.message}`);
        } finally {
            this.showImageProgress(false);
        }
    },

    async handleArchiveSelect(files) {
        const file = files[0]; // Беремо тільки перший файл

        if (file.size > 100 * 1024 * 1024) {
            alert('⚠️ Файл занадто великий. Максимум 100MB');
            return;
        }

        // Показуємо прогрес
        this.showArchiveProgress(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Додаємо код товару якщо є
            const codeInput = document.getElementById('code');
            if (codeInput && codeInput.value) {
                formData.append('code', codeInput.value);
            }

            const response = await this.uploadWithProgress(
                '/api/uploads/archive/multipart',
                formData,
                (progress) => this.updateArchiveProgress(progress)
            );

            if (response.success) {
                this.uploadedArchive = response;
                this.renderUploadedArchive();
                this.saveState();
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`❌ Помилка завантаження: ${error.message}`);
        } finally {
            this.showArchiveProgress(false);
        }
    },

    // ===== ЗАВАНТАЖЕННЯ З ПРОГРЕСОМ =====

    uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = (e.loaded / e.total) * 100;
                    onProgress(progress);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error'));
            });

            // Додаємо токен якщо є
            const token = localStorage.getItem('revitbot_token');

            xhr.open('POST', `${window.app.api.baseURL}${url}`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${JSON.parse(token)}`);
            }

            xhr.send(formData);
        });
    },

    // ===== UI ОНОВЛЕННЯ =====

    showImageProgress(show) {
        const progress = document.getElementById('image-upload-progress');
        const content = document.querySelector('#image-upload-zone .drop-zone-content');

        if (progress) progress.style.display = show ? 'block' : 'none';
        if (content) content.style.display = show ? 'none' : 'block';
    },

    showArchiveProgress(show) {
        const progress = document.getElementById('archive-upload-progress');
        const content = document.getElementById('archive-drop-content');
        const info = document.getElementById('archive-info');

        if (progress) progress.style.display = show ? 'block' : 'none';
        if (content) content.style.display = show ? 'none' : 'block';
        if (info && !show && this.uploadedArchive) {
            info.style.display = 'block';
        }
    },

    updateImageProgress(percent) {
        const fill = document.getElementById('image-progress-fill');
        const text = document.getElementById('image-progress-text');

        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = `Завантаження... ${Math.round(percent)}%`;
    },

    updateArchiveProgress(percent) {
        const fill = document.getElementById('archive-progress-fill');
        const text = document.getElementById('archive-progress-text');

        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = `Завантаження... ${Math.round(percent)}%`;
    },

    // ===== РЕНДЕРИНГ =====

    renderUploadedImages() {
        const container = document.getElementById('uploaded-images-grid');
        if (!container) return;

        container.innerHTML = this.uploadedImages.map((img, index) => `
            <div class="uploaded-image">
                <img src="${window.app.api.baseURL}/${img.sizes?.thumbnail || img.original}"
                     alt="${img.filename}"
                     onclick="AdminUploadEnhanced.showImagePreview(${index})">
                <button class="btn-remove" onclick="AdminUploadEnhanced.removeImage(${index})">
                    ×
                </button>
                <div class="image-name">${img.filename}</div>
            </div>
        `).join('');

        // Оновлюємо приховане поле
        const hiddenField = document.getElementById('image_paths_hidden');
        if (hiddenField) {
            hiddenField.value = JSON.stringify(this.uploadedImages.map(img => img.original));
        }
    },

    renderUploadedArchive() {
        if (!this.uploadedArchive) return;

        const nameEl = document.getElementById('archive-file-name');
        const sizeEl = document.getElementById('archive-file-size');
        const infoEl = document.getElementById('archive-info');
        const contentEl = document.getElementById('archive-drop-content');

        if (nameEl) nameEl.textContent = this.uploadedArchive.original_name;
        if (sizeEl) sizeEl.textContent = this.formatFileSize(this.uploadedArchive.file_size);
        if (infoEl) infoEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';

        // Оновлюємо приховані поля
        const pathField = document.getElementById('file_path_hidden');
        const sizeField = document.getElementById('file_size_hidden');

        if (pathField) pathField.value = this.uploadedArchive.file_path;
        if (sizeField) sizeField.value = this.uploadedArchive.file_size;
    },

    // ===== ВИДАЛЕННЯ ФАЙЛІВ =====

    async removeImage(index) {
        if (!confirm('Видалити це зображення?')) return;

        const image = this.uploadedImages[index];

        // Видаляємо з сервера якщо потрібно
        if (image.original) {
            try {
                const filename = image.original.split('/').pop();
                await window.app.api.delete(`/api/uploads/image/${filename}`);
            } catch (error) {
                console.error('Error deleting image:', error);
            }
        }

        // Видаляємо з масиву
        this.uploadedImages.splice(index, 1);
        this.renderUploadedImages();
        this.saveState();
    },

    async removeArchive() {
        if (!confirm('Видалити архів?')) return;

        if (this.uploadedArchive && this.uploadedArchive.file_path) {
            try {
                const filename = this.uploadedArchive.file_path.split('/').pop();
                await window.app.api.delete(`/api/uploads/archive/${filename}`);
            } catch (error) {
                console.error('Error deleting archive:', error);
            }
        }

        this.uploadedArchive = null;

        const infoEl = document.getElementById('archive-info');
        const contentEl = document.getElementById('archive-drop-content');

        if (infoEl) infoEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

        // Очищаємо приховані поля
        const pathField = document.getElementById('file_path_hidden');
        const sizeField = document.getElementById('file_size_hidden');

        if (pathField) pathField.value = '';
        if (sizeField) sizeField.value = '';

        this.saveState();
    },

    // ===== ПРЕВЬЮ =====

    showImagePreview(index) {
        const image = this.uploadedImages[index];
        if (!image) return;

        const modal = document.createElement('div');
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="preview-overlay" onclick="this.parentElement.remove()"></div>
            <div class="preview-content">
                <img src="${window.app.api.baseURL}/${image.sizes?.full || image.original}"
                     alt="${image.filename}">
                <div class="preview-info">
                    <h3>${image.filename}</h3>
                    <button class="btn btn-danger" onclick="AdminUploadEnhanced.removeImage(${index}); this.closest('.preview-modal').remove()">
                        🗑️ Видалити
                    </button>
                </div>
                <button class="preview-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        document.body.appendChild(modal);
    },

    async showArchivePreview() {
        if (!this.uploadedArchive) return;

        try {
            const filename = this.uploadedArchive.file_path.split('/').pop();
            const response = await window.app.api.get(`/api/uploads/archive/${filename}/preview`);

            const modal = document.createElement('div');
            modal.className = 'preview-modal';
            modal.innerHTML = `
                <div class="preview-overlay" onclick="this.parentElement.remove()"></div>
                <div class="preview-content archive-preview">
                    <h2>📦 Вміст архіву</h2>
                    <div class="archive-stats">
                        <div class="stat">
                            <span class="stat-label">Файлів:</span>
                            <span class="stat-value">${response.preview.file_count}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Розмір:</span>
                            <span class="stat-value">${this.formatFileSize(response.preview.total_size)}</span>
                        </div>
                    </div>
                    <div class="file-tree">
                        ${this.renderFileTree(response.preview.structure)}
                    </div>
                    <button class="preview-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
            `;

            document.body.appendChild(modal);
        } catch (error) {
            alert('Не вдалось завантажити превью');
        }
    },

    renderFileTree(structure, level = 0) {
        let html = '<ul class="file-tree-list">';

        for (const [name, content] of Object.entries(structure)) {
            const isFolder = content !== null;
            const icon = isFolder ? '📁' : '📄';

            html += `
                <li class="file-tree-item ${isFolder ? 'folder' : 'file'}">
                    <span style="padding-left: ${level * 20}px">
                        ${icon} ${name}
                    </span>
                    ${isFolder ? this.renderFileTree(content, level + 1) : ''}
                </li>
            `;
        }

        html += '</ul>';
        return html;
    },

    // ===== ДОПОМІЖНІ ФУНКЦІЇ =====

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    // ===== ІНТЕГРАЦІЯ З ФОРМОЮ =====

    collectFormData() {
        return {
            images: this.uploadedImages.map(img => img.original),
            archive: this.uploadedArchive ? {
                path: this.uploadedArchive.file_path,
                size: this.uploadedArchive.file_size
            } : null
        };
    },

    reset() {
        this.uploadedImages = [];
        this.uploadedArchive = null;
        this.currentArchiveId = null;

        sessionStorage.removeItem('upload_state');

        // Очищаємо UI
        const imagesGrid = document.getElementById('uploaded-images-grid');
        if (imagesGrid) imagesGrid.innerHTML = '';

        const archiveInfo = document.getElementById('archive-info');
        const archiveContent = document.getElementById('archive-drop-content');

        if (archiveInfo) archiveInfo.style.display = 'none';
        if (archiveContent) archiveContent.style.display = 'block';
    }
};

// Ініціалізуємо при завантаженні
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdminUploadEnhanced.init());
} else {
    AdminUploadEnhanced.init();
}