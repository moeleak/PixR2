import { getMotionStyles } from './motion.js';

/**
 * 提供文件上传页面的HTML
 * @returns {Response} - 包含上传页面HTML的响应
 */
export function serveUploadPage() {
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PixR2 - 上传</title>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/bootstrap-icons/1.13.1/font/bootstrap-icons.min.css">
        <style>
            ${getMotionStyles()}
            main > .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            .dropzone {
                border: 2px dashed #dee2e6;
                border-radius: .375rem;
                cursor: pointer;
                transition:
                    background-color var(--pixr2-normal) var(--pixr2-ease),
                    border-color var(--pixr2-normal) var(--pixr2-ease),
                    box-shadow var(--pixr2-normal) var(--pixr2-ease),
                    transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .dropzone:hover, .dropzone.active {
                border-color: #0d6efd;
                background-color: rgba(13, 110, 253, 0.05);
                box-shadow: 0 .75rem 1.5rem rgba(13, 110, 253, 0.12);
                transform: translateY(-2px);
            }
            .dropzone .bi {
                transition: transform var(--pixr2-normal) var(--pixr2-ease);
            }
            .dropzone:hover .bi,
            .dropzone.active .bi {
                transform: translateY(-2px) scale(1.06);
            }
            #selectedFiles .list-group-item,
            #modalContent .alert,
            #modalContent .card {
                animation: pixr2-fade-up var(--pixr2-normal) var(--pixr2-ease) both;
            }
            .min-w-0 {
                min-width: 0;
            }
            .upload-progress-wrap .progress {
                height: .45rem;
            }
            .upload-progress-wrap .progress-bar {
                transition: width 160ms var(--pixr2-ease);
            }
        </style>
        <script>
            // SVG 原始代码
            const svgIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none"><path fill="url(#fluentColorSettings480)" d="M19.494 43.468c1.479.353 2.993.531 4.513.531a19.4 19.4 0 0 0 4.503-.534a1.94 1.94 0 0 0 1.474-1.672l.338-3.071a2.32 2.32 0 0 1 2.183-2.075c.367-.016.732.053 1.068.2l2.807 1.231a1.92 1.92 0 0 0 1.554.01c.247-.105.468-.261.65-.458a20.4 20.4 0 0 0 4.51-7.779a1.94 1.94 0 0 0-.7-2.133l-2.494-1.84a2.326 2.326 0 0 1 0-3.764l2.486-1.836a1.94 1.94 0 0 0 .7-2.138a20.3 20.3 0 0 0-4.515-7.777a1.94 1.94 0 0 0-2.192-.45l-2.806 1.236c-.29.131-.606.2-.926.2a2.34 2.34 0 0 1-2.32-2.088l-.34-3.06a1.94 1.94 0 0 0-1.5-1.681a21.7 21.7 0 0 0-4.469-.519a22 22 0 0 0-4.5.52a1.935 1.935 0 0 0-1.5 1.677l-.34 3.062a2.35 2.35 0 0 1-.768 1.488a2.53 2.53 0 0 1-1.569.6a2.3 2.3 0 0 1-.923-.194l-2.8-1.236a1.94 1.94 0 0 0-2.2.452a20.35 20.35 0 0 0-4.51 7.775a1.94 1.94 0 0 0 .7 2.137l2.488 1.836a2.344 2.344 0 0 1 .701 2.938a2.34 2.34 0 0 1-.7.829l-2.49 1.839a1.94 1.94 0 0 0-.7 2.135a20.3 20.3 0 0 0 4.51 7.782a1.93 1.93 0 0 0 2.193.454l2.818-1.237c.291-.128.605-.194.923-.194h.008a2.34 2.34 0 0 1 2.32 2.074l.338 3.057a1.94 1.94 0 0 0 1.477 1.673M24 30.25a6.25 6.25 0 1 1 0-12.5a6.25 6.25 0 0 1 0 12.5"/><defs><linearGradient id="fluentColorSettings480" x1="33.588" x2="11.226" y1="42.451" y2="7.607" gradientUnits="userSpaceOnUse"><stop stop-color="#70777d"/><stop offset="1" stop-color="#b9c0c7"/></linearGradient></defs></g></svg>\`;
            // 创建 blob 和 URL
            const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            // 创建 favicon link
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/svg+xml';
            link.href = url;
            // 插入到 head 中
            document.head.appendChild(link);
        </script>
    </head>
    <body class="bg-light">
        <header>
            <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/upload">PixR2</a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
	                            <li class="nav-item">
	                                <a class="nav-link active" aria-current="page" href="/upload">上传文件</a>
	                            </li>
	                            <li class="nav-item">
	                                <a class="nav-link" href="/gallery">文件管理</a>
	                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>

        <main class="container my-5">
            <div class="card shadow-sm">
                <div class="card-body p-4 p-md-5">
	                    <h1 class="card-title h3 mb-4">上传文件</h1>
	                    <div class="dropzone text-center p-5 mb-3" id="dropzone">
	                        <i class="bi bi-upload fs-1 text-primary"></i>
	                        <p class="mt-3">拖拽文件到此处或点击选择文件</p>
	                        <p class="text-muted small">支持图片、文档、压缩包、音视频和其他常见文件</p>
	                        <input type="file" id="fileInput" class="d-none" multiple>
                    </div>

	                    <div class="form-check form-switch mb-3">
	                        <input class="form-check-input" type="checkbox" role="switch" id="randomName">
	                        <label class="form-check-label" for="randomName">使用随机文件名</label>
	                    </div>

	                    <div id="selectedFiles" class="mb-3"></div>

	                    <button id="uploadBtn" class="btn btn-primary w-100" disabled>上传文件</button>
                </div>
            </div>
        </main>

        <!-- Success Modal -->
        <div class="modal fade" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="successModalLabel">上传结果</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="modalContent">
                        <!-- Links will be populated here -->
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.7/js/bootstrap.bundle.min.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const dropzone = document.getElementById('dropzone');
                const fileInput = document.getElementById('fileInput');
                const selectedFilesContainer = document.getElementById('selectedFiles');
	                const uploadBtn = document.getElementById('uploadBtn');
	                const randomName = document.getElementById('randomName');
	                const successModalEl = document.getElementById('successModal');
                const successModal = new bootstrap.Modal(successModalEl);
                const modalContent = document.getElementById('modalContent');

                let selectedFiles = [];
                let uploadInProgress = false;
                let uploadProgress = [];
                const MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024;
                const MULTIPART_CONCURRENCY = 4;

                function escapeHtml(value = '') {
                    const htmlEscapes = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    };
                    return String(value).replace(/[&<>"']/g, char => htmlEscapes[char]);
                }

                dropzone.addEventListener('click', () => fileInput.click());
                dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('active'); });
                dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('active'); });
                dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('active'); handleFiles(e.dataTransfer.files); });
                fileInput.addEventListener('change', () => { handleFiles(fileInput.files); });

                function formatFileSize(bytes) {
                    if (bytes < 1024) return bytes + ' B';
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return \`\${(bytes / Math.pow(1024, i)).toFixed(2)} \${['B', 'KB', 'MB', 'GB'][i]}\`;
                }

                function getClientFileIcon(file) {
                    const name = file.name.toLowerCase();
                    const type = (file.type || '').toLowerCase();
                    const ext = name.includes('.') ? name.split('.').pop() : '';
                    if (type.startsWith('image/')) return 'bi-file-earmark-image';
                    if (type.startsWith('video/')) return 'bi-file-earmark-play';
                    if (type.startsWith('audio/')) return 'bi-file-earmark-music';
                    if (ext === 'pdf') return 'bi-file-earmark-pdf';
                    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'bi-file-earmark-zip';
                    if (['doc', 'docx'].includes(ext)) return 'bi-file-earmark-word';
                    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'bi-file-earmark-spreadsheet';
                    if (['ppt', 'pptx'].includes(ext)) return 'bi-file-earmark-slides';
                    if (['js', 'ts', 'html', 'css', 'json', 'md', 'py', 'go', 'rs', 'java', 'php', 'sh'].includes(ext)) return 'bi-file-earmark-code';
                    if (type.startsWith('text/') || ['txt', 'log'].includes(ext)) return 'bi-file-earmark-text';
                    return 'bi-file-earmark';
                }

                function handleFiles(files) {
                    if (uploadInProgress) return;
                    const validFiles = Array.from(files).filter(file => file && file.name);
                    if (validFiles.length === 0) return;
                    selectedFiles = [...selectedFiles, ...validFiles];
                    updateFilePreview();
                    uploadBtn.disabled = selectedFiles.length === 0;
                }

                function updateFilePreview() {
                    selectedFilesContainer.innerHTML = '';
                    if (selectedFiles.length === 0) return;

                    const list = document.createElement('ul');
                    list.className = 'list-group';
                    selectedFiles.forEach((file, index) => {
                        const item = document.createElement('li');
                        const safeName = escapeHtml(file.name);
                        const progress = uploadProgress[index] || { percent: 0, status: '等待上传' };
                        const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                        const progressClass = progress.error ? 'bg-danger' : progress.done ? 'bg-success' : '';
		                        item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3';
		                        item.innerHTML = \`
		                            <div class="flex-grow-1 min-w-0">
		                                <div class="d-flex align-items-center min-w-0">
		                                    <i class="bi \${getClientFileIcon(file)} me-2 text-secondary flex-shrink-0"></i>
		                                    <span class="text-truncate" title="\${safeName}">\${safeName}</span>
		                                    <small class="text-muted ms-2 flex-shrink-0">\${formatFileSize(file.size)}</small>
		                                </div>
		                                \${uploadInProgress ? \`
		                                    <div class="upload-progress-wrap mt-2" data-index="\${index}">
		                                        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${progressPercent}">
		                                            <div class="progress-bar \${progressClass}" style="width: \${progressPercent}%"></div>
		                                        </div>
		                                        <div class="small text-muted mt-1 upload-progress-label">\${escapeHtml(progress.status || progressPercent + '%')}</div>
		                                    </div>
		                                \` : ''}
		                            </div>
		                            <button type="button" class="btn-close" aria-label="Remove" data-index="\${index}" \${uploadInProgress ? 'disabled' : ''}></button>
	                        \`;
                        list.appendChild(item);
                    });
                    selectedFilesContainer.appendChild(list);

                    document.querySelectorAll('#selectedFiles .btn-close').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const index = parseInt(e.target.dataset.index);
                            if (uploadInProgress) return;
                            selectedFiles.splice(index, 1);
                            updateFilePreview();
                            uploadBtn.disabled = selectedFiles.length === 0;
                        });
                    });
                }

                function setUploadProgress(index, state) {
                    uploadProgress[index] = { ...(uploadProgress[index] || {}), ...state };
                    const progress = uploadProgress[index];
                    const progressPercent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
                    const wrap = selectedFilesContainer.querySelector(\`.upload-progress-wrap[data-index="\${index}"]\`);
                    if (!wrap) return;

                    const progressElement = wrap.querySelector('.progress');
                    const progressBar = wrap.querySelector('.progress-bar');
                    const progressLabel = wrap.querySelector('.upload-progress-label');
                    if (progressElement) progressElement.setAttribute('aria-valuenow', String(progressPercent));
                    if (progressBar) {
                        progressBar.style.width = progressPercent + '%';
                        progressBar.classList.toggle('bg-success', !!progress.done);
                        progressBar.classList.toggle('bg-danger', !!progress.error);
                    }
                    if (progressLabel) progressLabel.textContent = progress.status || progressPercent + '%';
                }

                async function postUploadJson(endpoint, payload) {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok || !data.success) {
                        throw new Error(data.message || '上传失败');
                    }
                    return data;
                }

                function uploadChunk(uploadUrl, chunk, contentType, onProgress) {
                    return new Promise(resolve => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', uploadUrl);
                        xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

                        xhr.upload.onprogress = event => {
                            if (event.lengthComputable) {
                                onProgress(event.loaded);
                            }
                        };

                        xhr.onload = () => {
                            let response = {};
                            try {
                                response = JSON.parse(xhr.responseText || '{}');
                            } catch {
                                response = {};
                            }
                            if (xhr.status >= 200 && xhr.status < 300 && !response.error) {
                                resolve(response);
                                return;
                            }
                            resolve({ error: true, message: response.message || '上传失败' });
                        };

                        xhr.onerror = () => {
                            resolve({ error: true, message: '网络错误' });
                        };

                        xhr.onabort = () => {
                            resolve({ error: true, message: '已取消' });
                        };

                        xhr.send(chunk);
                    });
                }

                async function uploadFile(file, index) {
                    let multipartUpload = null;
                    try {
                        const contentType = file.type || 'application/octet-stream';
                        setUploadProgress(index, { percent: 0, status: '准备上传' });
                        multipartUpload = await postUploadJson('/api/upload/multipart/create', {
                            filename: file.name,
                            path: '',
                            randomName: randomName.checked,
                            contentType
                        });

                        const totalParts = Math.max(1, Math.ceil(file.size / MULTIPART_CHUNK_SIZE));
                        const uploadedParts = new Array(totalParts);
                        const partLoadedBytes = new Array(totalParts).fill(0);
                        const parallelCount = Math.min(MULTIPART_CONCURRENCY, totalParts);
                        let nextPartNumber = 1;
                        let completedParts = 0;
                        let failed = false;
                        const errors = [];

                        const updateTotalProgress = (partNumber, loaded) => {
                            partLoadedBytes[partNumber - 1] = loaded;
                            const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                            const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                            setUploadProgress(index, {
                                percent,
                                status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                            });
                        };

                        const uploadPart = async partNumber => {
                            const start = (partNumber - 1) * MULTIPART_CHUNK_SIZE;
                            const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
                            const chunk = file.slice(start, end);
                            const partUrl = new URL('/api/upload/multipart/part', window.location.origin);
                            partUrl.searchParams.set('key', multipartUpload.key);
                            partUrl.searchParams.set('uploadId', multipartUpload.uploadId);
                            partUrl.searchParams.set('partNumber', String(partNumber));

                            const partResult = await uploadChunk(
                                partUrl.pathname + partUrl.search,
                                chunk,
                                contentType,
                                loaded => updateTotalProgress(partNumber, loaded)
                            );

                            if (partResult.error || !partResult.part) {
                                throw new Error(partResult.message || '上传分片失败');
                            }
                            uploadedParts[partNumber - 1] = partResult.part;
                            completedParts += 1;
                            updateTotalProgress(partNumber, end - start);
                            const uploadedBytes = partLoadedBytes.reduce((sum, value) => sum + value, 0);
                            const percent = file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100;
                            setUploadProgress(index, {
                                percent,
                                status: \`上传中 \${percent}%（\${completedParts}/\${totalParts}，并发 \${parallelCount}）\`
                            });
                        };

                        const workers = Array.from({ length: parallelCount }, async () => {
                            while (!failed && nextPartNumber <= totalParts) {
                                const partNumber = nextPartNumber++;
                                try {
                                    await uploadPart(partNumber);
                                } catch (error) {
                                    failed = true;
                                    errors.push(error);
                                }
                            }
                        });

                        await Promise.all(workers);
                        if (errors.length > 0) throw errors[0];

                        const completedUpload = await postUploadJson('/api/upload/multipart/complete', {
                            key: multipartUpload.key,
                            uploadId: multipartUpload.uploadId,
                            parts: uploadedParts.filter(Boolean),
                            contentType: multipartUpload.contentType
                        });

                        setUploadProgress(index, { percent: 100, status: '上传完成', done: true });
                        return completedUpload;
                    } catch (error) {
                        if (multipartUpload?.key && multipartUpload?.uploadId) {
                            await postUploadJson('/api/upload/multipart/abort', {
                                key: multipartUpload.key,
                                uploadId: multipartUpload.uploadId
                            }).catch(() => {});
                        }
                        setUploadProgress(index, { status: '上传失败', error: true });
                        return { error: true, message: error.message || '上传失败', name: file.name };
                    }
                }

                uploadBtn.addEventListener('click', async () => {
                    if (selectedFiles.length === 0) return;
                    uploadBtn.disabled = true;
                    uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...';
                    uploadInProgress = true;
                    uploadProgress = selectedFiles.map(() => ({ percent: 0, status: '等待上传' }));
                    updateFilePreview();

                    const uploadPromises = selectedFiles.map((file, index) => uploadFile(file, index));

                    const results = await Promise.all(uploadPromises);
                    displayResults(results);

                    uploadBtn.disabled = false;
	                    uploadBtn.textContent = '上传文件';
                    uploadInProgress = false;
                    uploadProgress = [];
                    selectedFiles = [];
                    updateFilePreview();
                    uploadBtn.disabled = true;
                });

                function displayResults(results) {
                    modalContent.innerHTML = '';
                    const successfulUploads = results.filter(r => !r.error);
                    const failedUploads = results.filter(r => r.error);

	                    if (failedUploads.length > 0) {
	                        const errorAlert = document.createElement('div');
	                        const failedNames = failedUploads.map(f => escapeHtml(f.name || '未知文件')).join(', ');
	                        errorAlert.className = 'alert alert-danger';
	                        errorAlert.innerHTML = \`<strong>\${failedUploads.length} 个文件上传失败:</strong> \${failedNames}\`;
	                        modalContent.appendChild(errorAlert);
	                    }

                    if (successfulUploads.length > 0) {
                        successfulUploads.forEach(result => {
                            const linkItem = document.createElement('div');
                            const safeKey = escapeHtml(result.key || '');
                            const safeUrl = escapeHtml(result.url || '');
                            const safeMarkdown = escapeHtml(result.markdown || '');
                            linkItem.className = 'card mb-3';
                            linkItem.innerHTML = \`
                                <div class="card-header">\${safeKey}</div>
                                <div class="card-body">
                                    <div class="mb-2">
                                        <label class="form-label small">直接链接</label>
                                        <div class="input-group">
                                            <input type="text" class="form-control form-control-sm" value="\${safeUrl}" readonly>
                                            <button class="btn btn-outline-secondary btn-sm copy-btn" data-text="\${safeUrl}">复制</button>
                                        </div>
                                    </div>
                                    <div>
		                                        <label class="form-label small">Markdown</label>
		                                        <div class="input-group">
		                                            <input type="text" class="form-control form-control-sm" value="\${safeMarkdown}" readonly>
		                                            <button class="btn btn-outline-secondary btn-sm copy-btn" data-text="\${safeMarkdown}">复制</button>
		                                        </div>
	                                    </div>
                                </div>
                            \`;
                            modalContent.appendChild(linkItem);
                        });
                    }
                    successModal.show();

                    document.querySelectorAll('.copy-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const textToCopy = e.currentTarget.dataset.text;
                            navigator.clipboard.writeText(textToCopy).then(() => {
                                const originalText = e.currentTarget.textContent;
                                e.currentTarget.textContent = '已复制';
                                setTimeout(() => { e.currentTarget.textContent = originalText; }, 1500);
                            });
                        });
                    });
                }
            });
        </script>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
