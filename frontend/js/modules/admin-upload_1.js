// frontend/js/modules/admin-upload.js - ВЕРСІЯ З ПРОГРЕС-БАРОМ ТА DRAG & DROP

window.AdminUploadModule = {
    uploadedImages: [],
    uploadedArchive: null,

    // --- УНІВЕРСАЛЬНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ З ПРОГРЕСОМ ---
    _uploadWithProgress(url, formData, progressContainerId, progressBarId, statusId) {
        return new Promise((resolve, reject) => {
            const container = document.getElementById(progressContainerId);
            const progressBar = document.getElementById(progressBarId);
            const status = document.getElementById(statusId);

            if (container) container.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (status) status.innerHTML = '⏳ Початок завантаження...';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${window.app.api.baseURL}${url}`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${window.app.api.token}`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    if (progressBar) progressBar.style.width = percentComplete.toFixed(2) + '%';
                    if (status) status.innerHTML = `⏳ Завантаження... ${percentComplete.toFixed(0)}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    const errorMsg = xhr.responseText || `Помилка сервера: ${xhr.status}`;
                    try {
                        const errorJson = JSON.parse(errorMsg);
                        reject(new Error(errorJson.detail || errorMsg));
                    } catch(e) {
                         reject(new Error(errorMsg));
                    }
                }
            };

            xhr.onerror = () => {
                reject(new Error('Помилка мережі. Не вдалося завантажити файл.'));
            };

            xhr.send(formData);
        });
    },

    // --- РОБОТА З АРХІВОМ ---
    async uploadArchiveFile(input) {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const data = await this._uploadWithProgress(
                '/api/uploads/archive',
                formData,
                'archive-upload-progress-container',
                'archive-progress-bar',
                'archive-status'
            );

            if (data.success) {
                this.uploadedArchive = data;
                document.getElementById('archive-status').innerHTML = `✅ ${file.name} (${(data.file_size / 1024 / 1024).toFixed(2)} MB)`;
                document.getElementById('file_path_hidden').value = data.file_path;
                document.getElementById('file_size_hidden').value = data.file_size;
            } else {
                throw new Error(data.message || 'Помилка на сервері');
            }
        } catch (error) {
            document.getElementById('archive-status').innerHTML = `❌ Помилка: ${error.message}`;
            document.getElementById('archive-progress-bar').style.backgroundColor = 'red';
        }
    },

    // --- РОБОТА ІЗ ЗОБРАЖЕННЯМИ (DRAG & DROP) ---
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
        event.currentTarget.style.borderColor = '#2196F3';
    },

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.style.backgroundColor = '';
        event.currentTarget.style.borderColor = '#ddd';
    },

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.style.backgroundColor = '';
        event.currentTarget.style.borderColor = '#ddd';
        const files = event.dataTransfer.files;
        this.handleFileSelect(files);
    },

    handleFileSelect(files) {
         this.uploadImages(Array.from(files));
    },

    async uploadImages(files) {
        if (!files.length) return;

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        // Створюємо тимчасовий прогрес-бар для зображень
        const previewContainer = document.getElementById('images-preview');
        const progressId = `images-progress-${Date.now()}`;
        previewContainer.insertAdjacentHTML('beforeend', `
            <div id="${progressId}" style="width: 100%; text-align: left;">
                <p id="${progressId}-status" style="font-size: 12px;">Завантаження ${files.length} фото...</p>
                <div style="background: #e0e0e0; border-radius: 5px; height: 5px;"><div id="${progressId}-bar" style="width:0%; height: 5px; background: var(--primary-color);"></div></div>
            </div>
        `);

        try {
            const data = await this._uploadWithProgress(
                '/api/uploads/images',
                formData,
                progressId,
                `${progressId}-bar`,
                `${progressId}-status`
            );

            document.getElementById(progressId)?.remove(); // Видаляємо прогрес-бар

            if (data.success) {
                this.uploadedImages.push(...data.image_paths);
                this.updateImagePreview();
            } else {
                 throw new Error(data.message || 'Помилка на сервері');
            }
        } catch (error) {
             const statusElem = document.getElementById(`${progressId}-status`);
             if (statusElem) statusElem.innerHTML = `❌ Помилка: ${error.message}`;
        }
    },

    updateImagePreview() {
        const preview = document.getElementById('images-preview');
        // Очищуємо попередні зображення, залишаючи прогрес-бари
        preview.querySelectorAll('.image-preview-item').forEach(el => el.remove());

        preview.insertAdjacentHTML('beforeend', this.uploadedImages.map((path, i) => `
            <div class="image-preview-item" style="position: relative; display: inline-block; margin: 5px;">
                <img src="${window.app.api.baseURL}/${path}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                <span onclick="AdminUploadModule.removeImage(${i})"
                    style="position: absolute; top: -5px; right: -5px; background: red; color: white;
                           border-radius: 50%; width: 20px; height: 20px; cursor: pointer;
                           display: flex; align-items: center; justify-content: center; font-size: 12px; line-height: 20px;">×</span>
            </div>
        `).join(''));

        document.getElementById('image_paths_hidden').value = JSON.stringify(this.uploadedImages);
    },

    removeImage(index) {
        this.uploadedImages.splice(index, 1);
        this.updateImagePreview();
    },

    reset() {
        this.uploadedImages = [];
        this.uploadedArchive = null;
    }
};