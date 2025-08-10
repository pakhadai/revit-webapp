// frontend/js/modules/comments.js - З ПОВНОЮ МУЛЬТИМОВНІСТЮ
window.CommentsModule = {
    comments: [],
    archiveId: null,

    async init(app) {
        this.app = app;
    },

    // Скорочення для перекладів
    t(key, params = {}) {
        let translation = this.app.t(`comments.${key}`);

        // Заміна параметрів в перекладі
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });

        return translation;
    },

    // Завантажити коментарі для архіву
    async loadComments(archiveId) {
        try {
            const data = await this.app.api.get(`/api/comments/${archiveId}`);
            this.comments = data.comments;
            this.archiveId = archiveId;
            return data;
        } catch (error) {
            console.error('Failed to load comments:', error);
            return { comments: [], total: 0 };
        }
    },

    // Показати модальне вікно з коментарями
    async showComments(archiveId) {
        const app = this.app;
        const data = await this.loadComments(archiveId);
        const lang = app.currentLang || 'ua';
        const archiveTitle = data.archive?.title[lang] || data.archive?.title['en'] || this.t('title');

        const modalId = 'comments-modal';
        this.closeModal();

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}" onclick="if(event.target.id === '${modalId}') CommentsModule.closeModal()">
                <div class="modal-content" style="max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h3>💬 ${this.t('titleWithName', { name: archiveTitle })}</h3>
                        <button onclick="CommentsModule.closeModal()" class="modal-close-btn">&times;</button>
                    </div>

                    <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                        <!-- Форма додавання коментаря -->
                        <div id="comment-form" style="margin-bottom: 20px; padding: 15px; background: var(--tg-theme-secondary-bg-color); border-radius: 8px;">
                            <textarea
                                id="new-comment-text"
                                placeholder="${this.t('placeholder')}"
                                style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 6px; resize: vertical; font-family: inherit; font-size: 14px;"
                                maxlength="500"
                            ></textarea>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                <span id="char-counter" style="font-size: 12px; color: var(--tg-theme-hint-color);">
                                    ${this.t('charCounter', { current: 0, max: 500 })}
                                </span>
                                <button
                                    onclick="CommentsModule.addComment()"
                                    style="padding: 8px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"
                                >
                                    📝 ${this.t('addComment')}
                                </button>
                            </div>
                        </div>

                        <!-- Список коментарів -->
                        <div id="comments-list">
                            ${this.renderCommentsList(data.comments)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Додаємо лічильник символів
        const textarea = document.getElementById('new-comment-text');
        const counter = document.getElementById('char-counter');
        textarea.addEventListener('input', () => {
            counter.textContent = this.t('charCounter', {
                current: textarea.value.length,
                max: 500
            });
        });
    },

    // Рендер списку коментарів
    renderCommentsList(comments) {
        if (!comments || comments.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: var(--tg-theme-hint-color);">
                    <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                    <p>${this.t('noComments')}. ${this.t('beFirst')}</p>
                </div>
            `;
        }

        return comments.map(comment => this.renderComment(comment)).join('');
    },

    // Форматування дати залежно від мови
    formatDate(dateString) {
        const date = new Date(dateString);
        const lang = this.app.currentLang || 'ua';
        const locale = lang === 'ua' ? 'uk-UA' : 'en-US';

        const dateStr = date.toLocaleDateString(locale);
        const timeStr = date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${dateStr} ${lang === 'ua' ? 'о' : 'at'} ${timeStr}`;
    },

    // Рендер одного коментаря
    renderComment(comment, isReply = false) {
        const app = this.app;
        const currentUserId = app.user?.id;
        const isOwner = comment.user.id === currentUserId;
        const isAdmin = app.user?.isAdmin;
        const isDeleted = comment.text === this.t('deleted') || comment.text.includes('[Коментар видалено]');

        const commentHtml = `
            <div class="comment-item" id="comment-${comment.id}" style="
                background: ${isReply ? 'var(--tg-theme-secondary-bg-color)' : 'var(--tg-theme-bg-color)'};
                border: 1px solid var(--tg-theme-secondary-bg-color);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: ${isReply ? '8px' : '15px'};
                ${isReply ? 'margin-left: 40px;' : ''}
            ">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
                            ${comment.user.full_name ? comment.user.full_name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">
                                ${comment.user.full_name || comment.user.username || this.t('user')}
                            </div>
                            <div style="font-size: 11px; color: var(--tg-theme-hint-color);">
                                ${this.formatDate(comment.created_at)}
                                ${comment.is_edited ? ` • (${this.t('edited')})` : ''}
                            </div>
                        </div>
                    </div>

                    ${(isOwner || isAdmin) && !isDeleted ? `
                        <div style="display: flex; gap: 8px;">
                            ${isOwner ? `
                                <button
                                    onclick="CommentsModule.editComment(${comment.id})"
                                    style="background: none; border: none; color: var(--tg-theme-hint-color); cursor: pointer; font-size: 20px;"
                                    title="${this.t('edit')}">✏️</button>
                            ` : ''}
                            <button
                                onclick="CommentsModule.deleteComment(${comment.id})"
                                style="background: none; border: none; color: var(--tg-theme-hint-color); cursor: pointer; font-size: 20px;"
                                title="${this.t('delete')}">🗑️</button>
                        </div>
                    ` : ''}
                </div>

                <div id="comment-text-${comment.id}" style="font-size: 14px; line-height: 1.5; margin-bottom: 10px;">
                    ${isDeleted ? `<span style="color: var(--tg-theme-hint-color); font-style: italic;">${this.t('deleted')}</span>` : comment.text}
                </div>

                ${!isReply && !isDeleted ? `
                    <button
                        onclick="CommentsModule.showReplyForm(${comment.id})"
                        style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 13px; font-weight: 600;"
                    >
                        ↩️ ${this.t('reply')}
                    </button>
                ` : ''}

                <!-- Форма відповіді (спочатку прихована) -->
                <div id="reply-form-${comment.id}" style="display: none; margin-top: 10px; padding: 10px; background: var(--tg-theme-secondary-bg-color); border-radius: 6px;">
                    <textarea
                        id="reply-text-${comment.id}"
                        placeholder="${this.t('replyPlaceholder')}"
                        style="width: 100%; min-height: 60px; padding: 8px; border: 1px solid var(--tg-theme-secondary-bg-color); border-radius: 4px; resize: vertical; font-family: inherit; font-size: 13px;"
                        maxlength="500"
                    ></textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button
                            onclick="CommentsModule.addReply(${comment.id})"
                            style="padding: 6px 12px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
                        >
                            ${this.t('send')}
                        </button>
                        <button
                            onclick="CommentsModule.hideReplyForm(${comment.id})"
                            style="padding: 6px 12px; background: var(--tg-theme-secondary-bg-color); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
                        >
                            ${this.t('cancel')}
                        </button>
                    </div>
                </div>

                <!-- Відповіді -->
                ${comment.replies && comment.replies.length > 0 ? `
                    <div style="margin-top: 15px;">
                        ${comment.replies.map(reply => this.renderComment(reply, true)).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        return commentHtml;
    },

    // Додати коментар
    async addComment() {
        const textarea = document.getElementById('new-comment-text');
        const text = textarea.value.trim();

        if (!text || text.length < 3) {
            this.app.tg.showAlert(this.t('minLength'));
            return;
        }

        try {
            const response = await this.app.api.post(`/api/comments/${this.archiveId}`, { text });

            if (response.success) {
                // Додаємо новий коментар на початок списку
                this.comments.unshift({
                    ...response.comment,
                    replies: []
                });

                // Оновлюємо список
                document.getElementById('comments-list').innerHTML = this.renderCommentsList(this.comments);

                // Очищаємо форму
                textarea.value = '';
                document.getElementById('char-counter').textContent = this.t('charCounter', {
                    current: 0,
                    max: 500
                });

                // Показуємо повідомлення
                if (this.app.tg.isAvailable && this.app.tg.HapticFeedback) {
                    this.app.tg.HapticFeedback.notificationOccurred('success');
                }
            }
        } catch (error) {
            this.app.tg.showAlert(`${this.t('error')}: ${error.message}`);
        }
    },

    // Показати форму відповіді
    showReplyForm(commentId) {
        // Ховаємо всі інші форми відповіді
        document.querySelectorAll('[id^="reply-form-"]').forEach(form => {
            form.style.display = 'none';
        });

        // Показуємо потрібну форму
        const form = document.getElementById(`reply-form-${commentId}`);
        if (form) {
            form.style.display = 'block';
            document.getElementById(`reply-text-${commentId}`).focus();
        }
    },

    // Сховати форму відповіді
    hideReplyForm(commentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        if (form) {
            form.style.display = 'none';
            document.getElementById(`reply-text-${commentId}`).value = '';
        }
    },

    // Додати відповідь
    async addReply(parentId) {
        const textarea = document.getElementById(`reply-text-${parentId}`);
        const text = textarea.value.trim();

        if (!text || text.length < 3) {
            this.app.tg.showAlert(this.t('replyMinLength'));
            return;
        }

        try {
            const response = await this.app.api.post(`/api/comments/${this.archiveId}`, {
                text,
                parent_id: parentId
            });

            if (response.success) {
                // Знаходимо батьківський коментар і додаємо відповідь
                const parentComment = this.comments.find(c => c.id === parentId);
                if (parentComment) {
                    if (!parentComment.replies) {
                        parentComment.replies = [];
                    }
                    parentComment.replies.push(response.comment);
                }

                // Оновлюємо список
                document.getElementById('comments-list').innerHTML = this.renderCommentsList(this.comments);

                // Ховаємо форму
                this.hideReplyForm(parentId);

                // Показуємо повідомлення
                this.app.tg.showAlert(`✅ ${this.t('replyAdded')}`);
            }
        } catch (error) {
            this.app.tg.showAlert(`${this.t('error')}: ${error.message}`);
        }
    },

    // Редагувати коментар
    async editComment(commentId) {
        const comment = this.findComment(commentId);
        if (!comment) return;

        const newText = prompt(this.t('editPrompt'), comment.text);
        if (!newText || newText.trim() === comment.text) return;

        try {
            const response = await this.app.api.put(`/api/comments/${commentId}`, {
                text: newText.trim()
            });

            if (response.success) {
                // Оновлюємо коментар
                comment.text = newText.trim();
                comment.is_edited = true;

                // Перерендерюємо список
                document.getElementById('comments-list').innerHTML = this.renderCommentsList(this.comments);

                this.app.tg.showAlert(`✅ ${this.t('commentUpdated')}`);
            }
        } catch (error) {
            this.app.tg.showAlert(`${this.t('error')}: ${error.message}`);
        }
    },

    // Видалити коментар
    async deleteComment(commentId) {
        if (!confirm(this.t('confirmDelete'))) return;

        try {
            const response = await this.app.api.delete(`/api/comments/${commentId}`);

            if (response.success) {
                // Оновлюємо коментар
                const comment = this.findComment(commentId);
                if (comment) {
                    comment.text = this.t('deleted');
                    comment.is_deleted = true;
                }

                // Перерендерюємо список
                document.getElementById('comments-list').innerHTML = this.renderCommentsList(this.comments);

                this.app.tg.showAlert(`✅ ${this.t('commentDeleted')}`);
            }
        } catch (error) {
            this.app.tg.showAlert(`${this.t('error')}: ${error.message}`);
        }
    },

    // Знайти коментар (включаючи відповіді)
    findComment(commentId) {
        for (const comment of this.comments) {
            if (comment.id === commentId) return comment;
            if (comment.replies) {
                for (const reply of comment.replies) {
                    if (reply.id === commentId) return reply;
                }
            }
        }
        return null;
    },

    // Закрити модальне вікно
    closeModal() {
        const modal = document.getElementById('comments-modal');
        if (modal) modal.remove();
    }
};