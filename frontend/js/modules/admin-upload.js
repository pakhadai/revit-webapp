window.AdminUploadModule = {
    uploadedImages: [],
    uploadedArchive: null,

    async uploadArchiveFile(input) {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const status = document.getElementById('archive-status');
        status.innerHTML = '⏳ Завантаження...';

        try {
            const response = await fetch('/api/uploads/archive', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.app.storage.get('jwt_token')}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                this.uploadedArchive = data;
                status.innerHTML = `✅ ${file.name} (${(data.file_size/1024/1024).toFixed(2)} MB)`;
                document.getElementById('file_path_hidden').value = data.file_path;
                document.getElementById('file_size_hidden').value = data.file_size;
            }
        } catch (error) {
            status.innerHTML = `❌ Помилка: ${error.message}`;
        }
    },

    async uploadImages(input) {
        const files = Array.from(input.files);
        if (!files.length) return;

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        const status = document.getElementById('images-status');
        const preview = document.getElementById('images-preview');
        status.innerHTML = '⏳ Завантаження...';

        try {
            const response = await fetch('/api/uploads/images', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.app.storage.get('jwt_token')}`
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                this.uploadedImages.push(...data.image_paths);
                status.innerHTML = `✅ Завантажено ${data.count} фото`;

                preview.innerHTML = this.uploadedImages.map((path, i) => `
                    <div style="position: relative; display: inline-block; margin: 5px;">
                        <img src="/${path}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                        <span onclick="AdminUploadModule.removeImage(${i})"
                            style="position: absolute; top: -5px; right: -5px; background: red; color: white;
                                   border-radius: 50%; width: 20px; height: 20px; cursor: pointer;
                                   display: flex; align-items: center; justify-content: center;">×</span>
                    </div>
                `).join('');

                document.getElementById('image_paths_hidden').value = JSON.stringify(this.uploadedImages);
            }
        } catch (error) {
            status.innerHTML = `❌ Помилка: ${error.message}`;
        }
    },

    removeImage(index) {
        this.uploadedImages.splice(index, 1);
        document.getElementById('image_paths_hidden').value = JSON.stringify(this.uploadedImages);

        const preview = document.getElementById('images-preview');
        preview.innerHTML = this.uploadedImages.map((path, i) => `
            <div style="position: relative; display: inline-block; margin: 5px;">
                <img src="/${path}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                <span onclick="AdminUploadModule.removeImage(${i})"
                    style="position: absolute; top: -5px; right: -5px; background: red; color: white;
                           border-radius: 50%; width: 20px; height: 20px; cursor: pointer;
                           display: flex; align-items: center; justify-content: center;">×</span>
            </div>
        `).join('');
    },

    reset() {
        this.uploadedImages = [];
        this.uploadedArchive = null;
    }
};