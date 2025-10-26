        // Global state for document management
        let currentView = 'list';
        let currentPath = '';
        let fileSystem = {};
        let searchTerm = '';
        let selectedTenant = 'Tenant Name';
        let selectedType = 'All Types';
        let selectedModified = 'Any time';
        let contextItem = null;
        let selectedFiles = [];
        let selectedAttachments = [];

        // Initialize document management when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            setupDocumentManagement();
        });

        function setupDocumentManagement() {
            setupEventListeners();
            addSampleData();
            renderBreadcrumb();
            renderItems();
        }

        function addSampleData() {
            fileSystem['BIR 2025'] = {
                type: 'folder',
                name: 'BIR 2025',
                created: new Date('2024-01-15'),
                path: 'BIR 2025',
                parentPath: ''
            };

            fileSystem['Certificate'] = {
                type: 'folder',
                name: 'Certificate',
                created: new Date('2024-02-10'),
                path: 'Certificate',
                parentPath: ''
            };

            fileSystem['Tax'] = {
                type: 'folder',
                name: 'Tax',
                created: new Date('2024-03-05'),
                path: 'Tax',
                parentPath: ''
            };

            fileSystem['Sample Document.pdf'] = {
                type: 'file',
                name: 'Sample Document.pdf',
                size: 1024000,
                created: new Date('2024-03-10'),
                path: 'Sample Document.pdf',
                parentPath: ''
            };

            renderItems();
        }

        function setupEventListeners() {
            // File input changes
            const fileInput = document.getElementById('fileInput');
            const attachmentInput = document.getElementById('attachmentInput');
            
            if (fileInput) fileInput.addEventListener('change', handleFileSelect);
            if (attachmentInput) attachmentInput.addEventListener('change', handleAttachmentSelect);

            // Drag and drop
            const dropZone = document.getElementById('dropZone');
            if (dropZone) {
                dropZone.addEventListener('dragover', handleDragOver);
                dropZone.addEventListener('dragleave', handleDragLeave);
                dropZone.addEventListener('drop', handleDrop);
            }

            const attachmentDropZone = document.getElementById('attachmentDropZone');
            if (attachmentDropZone) {
                attachmentDropZone.addEventListener('dragover', handleAttachmentDragOver);
                attachmentDropZone.addEventListener('dragleave', handleAttachmentDragLeave);
                attachmentDropZone.addEventListener('drop', handleAttachmentDrop);
            }

            // Enter key handlers
            const folderNameInput = document.getElementById('folderName');
            const newNameInput = document.getElementById('newName');
            
            if (folderNameInput) {
                folderNameInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') createFolder();
                });
            }
            
            if (newNameInput) {
                newNameInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') confirmRename();
                });
            }

            // Click outside handlers
            window.addEventListener('click', function(e) {
                if (e.target.classList.contains('modal')) {
                    closeModal(e.target.id);
                }
                
                if (!e.target.closest('.dropdown') && !e.target.closest('.btn-add')) {
                    document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(dropdown => {
                        dropdown.style.display = 'none';
                    });
                }
                
                if (!e.target.closest('.context-menu') && !e.target.closest('.more-icon')) {
                    const contextMenu = document.getElementById('contextMenu');
                    if (contextMenu) contextMenu.style.display = 'none';
                }
            });

            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
            });
        }

        function toggleAddMenu() {
            const menu = document.getElementById('addMenu');
            if (!menu) return;
            
            const isVisible = menu.style.display === 'block';
            
            // Close all dropdowns
            document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(d => {
                d.style.display = 'none';
            });
            
            if (!isVisible) {
                menu.style.display = 'block';
            }
        }

        function toggleDropdown(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            if (!dropdown) return;
            
            const isVisible = dropdown.style.display === 'block';
            
            // Close all dropdowns
            document.querySelectorAll('.dropdown-content, .add-dropdown-content').forEach(d => {
                d.style.display = 'none';
            });
            
            if (!isVisible) {
                dropdown.style.display = 'block';
            }
        }

        function selectTenant(tenant) {
            selectedTenant = tenant;
            const button = document.querySelector('#tenantDropdown').parentElement.querySelector('.dropdown-button span');
            if (button) button.textContent = tenant;
            document.getElementById('tenantDropdown').style.display = 'none';
            renderItems();
        }

        function selectType(type) {
            selectedType = type;
            const button = document.querySelector('#typeDropdown').parentElement.querySelector('.dropdown-button span');
            if (button) button.textContent = type;
            document.getElementById('typeDropdown').style.display = 'none';
            renderItems();
        }

        function selectModified(modified) {
            selectedModified = modified;
            const button = document.querySelector('#modifiedDropdown').parentElement.querySelector('.dropdown-button span');
            if (button) button.textContent = modified;
            document.getElementById('modifiedDropdown').style.display = 'none';
            renderItems();
        }

        function switchView(view) {
            currentView = view;
            
            const listBtn = document.getElementById('listBtn');
            const gridBtn = document.getElementById('gridBtn');
            
            if (listBtn) listBtn.classList.remove('active');
            if (gridBtn) gridBtn.classList.remove('active');
            
            const activeBtn = document.getElementById(view + 'Btn');
            if (activeBtn) activeBtn.classList.add('active');

            const container = document.getElementById('itemsContainer');
            if (container) {
                container.className = view === 'list' ? 'items-container list-view' : 'items-container grid-view';
            }
            
            renderItems();
        }

        function showContextMenu(event, itemPath) {
            event.preventDefault();
            event.stopPropagation();
            
            contextItem = itemPath;
            const contextMenu = document.getElementById('contextMenu');
            if (!contextMenu) return;
            
            const x = event.pageX;
            const y = event.pageY;
            const menuWidth = 160;
            const menuHeight = 120;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            let left = x;
            let top = y;
            
            if (x + menuWidth > windowWidth) {
                left = x - menuWidth;
            }
            
            if (y + menuHeight > windowHeight) {
                top = y - menuHeight;
            }
            
            contextMenu.style.display = 'block';
            contextMenu.style.left = left + 'px';
            contextMenu.style.top = top + 'px';
        }

        function openItem() {
            if (!contextItem) return;
            
            const item = fileSystem[contextItem];
            if (!item) return;
            
            if (item.type === 'folder') {
                navigateToFolder(item.path);
            } else {
                openFile(item.path);
            }
            
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) contextMenu.style.display = 'none';
            contextItem = null;
        }

        function renameItem() {
            if (!contextItem) return;
            
            const item = fileSystem[contextItem];
            if (!item) return;
            
            const newNameInput = document.getElementById('newName');
            const renameModal = document.getElementById('renameModal');
            const contextMenu = document.getElementById('contextMenu');
            
            if (newNameInput) newNameInput.value = item.name;
            if (renameModal) {
                renameModal.style.display = 'block';
                setTimeout(() => {
                    renameModal.classList.add('show');
                    newNameInput.focus();
                    newNameInput.select();
                }, 10);
            }
            if (contextMenu) contextMenu.style.display = 'none';
        }

        function deleteItem() {
            if (!contextItem) return;
            
            const item = fileSystem[contextItem];
            if (!item) return;
            
            const deleteItemName = document.getElementById('deleteItemName');
            const deleteModal = document.getElementById('deleteModal');
            const contextMenu = document.getElementById('contextMenu');
            const deleteWarning = document.getElementById('deleteWarning');
            
            if (deleteItemName) deleteItemName.textContent = item.name;
            
            if (item.type === 'folder') {
                const childrenCount = Object.values(fileSystem).filter(i => i.parentPath === contextItem).length;
                if (deleteWarning) {
                    if (childrenCount > 0) {
                        deleteWarning.style.display = 'block';
                    } else {
                        deleteWarning.style.display = 'none';
                    }
                }
            } else {
                if (deleteWarning) deleteWarning.style.display = 'none';
            }
            
            if (deleteModal) {
                deleteModal.style.display = 'block';
                setTimeout(() => deleteModal.classList.add('show'), 10);
            }
            if (contextMenu) contextMenu.style.display = 'none';
        }

        function confirmRename() {
            const newNameInput = document.getElementById('newName');
            if (!newNameInput || !contextItem) return;
            
            const newName = newNameInput.value.trim();
            if (!newName) return;
            
            const item = fileSystem[contextItem];
            if (!item) return;
            
            const parentPath = item.parentPath;
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            
            if (newPath !== contextItem && fileSystem[newPath]) {
                if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
                    window.showAlert('An item with this name already exists', 'warning');
                } else {
                    alert('An item with this name already exists');
                }
                return;
            }
            
            const oldName = item.name;
            item.name = newName;
            item.path = newPath;
            
            if (newPath !== contextItem) {
                fileSystem[newPath] = item;
                delete fileSystem[contextItem];
                
                if (item.type === 'folder') {
                    updateChildrenPaths(contextItem, newPath);
                }
            }
            
            closeModal('renameModal');
            renderItems();
            showNotification(`"${oldName}" renamed to "${newName}"`, 'success');
        }

        function updateChildrenPaths(oldParentPath, newParentPath) {
            Object.keys(fileSystem).forEach(path => {
                const item = fileSystem[path];
                if (item.parentPath === oldParentPath) {
                    const newPath = `${newParentPath}/${item.name}`;
                    item.parentPath = newParentPath;
                    item.path = newPath;
                    
                    if (path !== newPath) {
                        fileSystem[newPath] = item;
                        delete fileSystem[path];
                        
                        if (item.type === 'folder') {
                            updateChildrenPaths(path, newPath);
                        }
                    }
                }
            });
        }

        function confirmDelete() {
            if (!contextItem) return;
            
            const item = fileSystem[contextItem];
            if (!item) return;
            
            const itemName = item.name;
            
            if (item.type === 'folder') {
                deleteChildren(contextItem);
            }
            
            delete fileSystem[contextItem];
            
            closeModal('deleteModal');
            renderItems();
            showNotification(`"${itemName}" deleted successfully`, 'success');
            contextItem = null;
        }

        function deleteChildren(folderPath) {
            const childrenToDelete = [];
            
            Object.keys(fileSystem).forEach(path => {
                const item = fileSystem[path];
                if (item.parentPath === folderPath) {
                    childrenToDelete.push(path);
                }
            });
            
            childrenToDelete.forEach(childPath => {
                const childItem = fileSystem[childPath];
                if (childItem) {
                    if (childItem.type === 'folder') {
                        deleteChildren(childPath);
                    }
                    delete fileSystem[childPath];
                }
            });
        }

        function showNewFolderModal() {
            const addMenu = document.getElementById('addMenu');
            const folderModal = document.getElementById('folderModal');
            const folderNameInput = document.getElementById('folderName');
            
            if (addMenu) addMenu.style.display = 'none';
            if (folderModal) {
                folderModal.style.display = 'block';
                setTimeout(() => folderModal.classList.add('show'), 10);
            }
            if (folderNameInput) folderNameInput.focus();
        }

        function showUploadModal() {
            const addMenu = document.getElementById('addMenu');
            const uploadModal = document.getElementById('uploadModal');
            
            if (addMenu) addMenu.style.display = 'none';
            if (uploadModal) {
                uploadModal.style.display = 'block';
                setTimeout(() => uploadModal.classList.add('show'), 10);
            }
            selectedFiles = [];
            updateSelectedFilesDisplay();
        }

        function showAttachmentModal() {
            const addMenu = document.getElementById('addMenu');
            const attachmentModal = document.getElementById('attachmentModal');
            
            if (addMenu) addMenu.style.display = 'none';
            if (attachmentModal) {
                attachmentModal.style.display = 'block';
                setTimeout(() => attachmentModal.classList.add('show'), 10);
            }
            selectedAttachments = [];
            updateSelectedAttachmentsDisplay();
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            
            switch(modalId) {
                case 'folderModal':
                    const folderNameInput = document.getElementById('folderName');
                    if (folderNameInput) folderNameInput.value = '';
                    break;
                case 'uploadModal':
                    const fileInput = document.getElementById('fileInput');
                    if (fileInput) fileInput.value = '';
                    selectedFiles = [];
                    updateSelectedFilesDisplay();
                    break;
                case 'attachmentModal':
                    const attachmentInput = document.getElementById('attachmentInput');
                    if (attachmentInput) attachmentInput.value = '';
                    selectedAttachments = [];
                    updateSelectedAttachmentsDisplay();
                    break;
                case 'renameModal':
                    const newNameInput = document.getElementById('newName');
                    if (newNameInput) newNameInput.value = '';
                    contextItem = null;
                    break;
                case 'deleteModal':
                    contextItem = null;
                    break;
            }
        }

        function createFolder() {
            const folderNameInput = document.getElementById('folderName');
            if (!folderNameInput) return;
            
            const folderName = folderNameInput.value.trim();
            if (!folderName) return;

            const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            
            if (fileSystem[folderPath]) {
                if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
                    window.showAlert('Folder already exists!', 'warning');
                } else {
                    alert('Folder already exists!');
                }
                return;
            }

            fileSystem[folderPath] = {
                type: 'folder',
                name: folderName,
                created: new Date(),
                path: folderPath,
                parentPath: currentPath
            };

            closeModal('folderModal');
            renderItems();
            showNotification(`Folder "${folderName}" created successfully`, 'success');
        }

        function getFileType(fileName) {
            const extension = fileName.toLowerCase().split('.').pop();
            switch (extension) {
                case 'pdf':
                    return { icon: '📄', class: 'pdf-icon', type: 'document' };
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'svg':
                    return { icon: '🖼️', class: 'image-icon', type: 'image' };
                case 'doc':
                case 'docx':
                    return { icon: '📝', class: 'doc-icon', type: 'document' };
                case 'xls':
                case 'xlsx':
                    return { icon: '📊', class: 'doc-icon', type: 'document' };
                case 'txt':
                    return { icon: '📄', class: 'file-icon', type: 'document' };
                default:
                    return { icon: '📄', class: 'file-icon', type: 'other' };
            }
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function handleFileSelect(event) {
            const files = Array.from(event.target.files);
            selectedFiles = [...selectedFiles, ...files];
            updateSelectedFilesDisplay();
        }

        function handleAttachmentSelect(event) {
            const files = Array.from(event.target.files);
            selectedAttachments = [...selectedAttachments, ...files];
            updateSelectedAttachmentsDisplay();
        }

        function updateSelectedFilesDisplay() {
            const container = document.getElementById('selectedFiles');
            if (!container) return;
            
            if (selectedFiles.length === 0) {
                container.innerHTML = '';
                return;
            }

            let html = '';
            selectedFiles.forEach((file, index) => {
                html += `
                    <div class="selected-file">
                        <span>${file.name} (${formatFileSize(file.size)})</span>
                        <button class="remove-file" onclick="removeFile(${index})">✕</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function updateSelectedAttachmentsDisplay() {
            const container = document.getElementById('selectedAttachments');
            if (!container) return;
            
            if (selectedAttachments.length === 0) {
                container.innerHTML = '';
                return;
            }

            let html = '';
            selectedAttachments.forEach((file, index) => {
                html += `
                    <div class="selected-file">
                        <span>${file.name} (${formatFileSize(file.size)})</span>
                        <button class="remove-file" onclick="removeAttachment(${index})">✕</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function removeFile(index) {
            selectedFiles.splice(index, 1);
            updateSelectedFilesDisplay();
        }

        function removeAttachment(index) {
            selectedAttachments.splice(index, 1);
            updateSelectedAttachmentsDisplay();
        }

        function handleDragOver(event) {
            event.preventDefault();
            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.classList.add('drag-over');
        }

        function handleDragLeave(event) {
            event.preventDefault();
            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.classList.remove('drag-over');
        }

        function handleDrop(event) {
            event.preventDefault();
            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.classList.remove('drag-over');
            const files = Array.from(event.dataTransfer.files);
            selectedFiles = [...selectedFiles, ...files];
            updateSelectedFilesDisplay();
        }

        function handleAttachmentDragOver(event) {
            event.preventDefault();
            const attachmentDropZone = document.getElementById('attachmentDropZone');
            if (attachmentDropZone) attachmentDropZone.classList.add('drag-over');
        }

        function handleAttachmentDragLeave(event) {
            event.preventDefault();
            const attachmentDropZone = document.getElementById('attachmentDropZone');
            if (attachmentDropZone) attachmentDropZone.classList.remove('drag-over');
        }

        function handleAttachmentDrop(event) {
            event.preventDefault();
            const attachmentDropZone = document.getElementById('attachmentDropZone');
            if (attachmentDropZone) attachmentDropZone.classList.remove('drag-over');
            const files = Array.from(event.dataTransfer.files);
            selectedAttachments = [...selectedAttachments, ...files];
            updateSelectedAttachmentsDisplay();
        }

        async function uploadFiles() {
            if (selectedFiles.length === 0) return;

            for (const file of selectedFiles) {
                const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;

                if (fileSystem[filePath]) {
                    let replace = false;
                    try {
                        if (typeof window !== 'undefined' && typeof window.showConfirm === 'function') {
                            replace = await window.showConfirm(`File "${file.name}" already exists. Replace it?`, 'Replace file?');
                        } else {
                            replace = confirm(`File "${file.name}" already exists. Replace it?`);
                        }
                    } catch (e) {
                        // in case of unexpected error, fallback to native confirm
                        replace = confirm(`File "${file.name}" already exists. Replace it?`);
                    }

                    if (!replace) {
                        // skip this file
                        continue;
                    }
                }

                fileSystem[filePath] = {
                    type: 'file',
                    name: file.name,
                    size: file.size,
                    lastModified: new Date(file.lastModified),
                    created: new Date(),
                    path: filePath,
                    parentPath: currentPath,
                    file: file
                };
            }

            closeModal('uploadModal');
            renderItems();
            showNotification(`${selectedFiles.length} file(s) uploaded successfully`, 'success');
        }

        function attachFiles() {
            if (selectedAttachments.length === 0) return;

            selectedAttachments.forEach(file => {
                const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
                const attachmentName = `attachment_${timestamp}_${file.name}`;
                const filePath = currentPath ? `${currentPath}/${attachmentName}` : attachmentName;
                
                fileSystem[filePath] = {
                    type: 'file',
                    name: attachmentName,
                    size: file.size,
                    lastModified: new Date(file.lastModified),
                    created: new Date(),
                    path: filePath,
                    parentPath: currentPath,
                    file: file,
                    isAttachment: true
                };
            });

            closeModal('attachmentModal');
            renderItems();
            showNotification(`${selectedAttachments.length} attachment(s) added successfully`, 'success');
        }

        function navigateToFolder(path) {
            currentPath = path;
            renderBreadcrumb();
            renderItems();
        }

        function renderBreadcrumb() {
            const breadcrumb = document.getElementById('breadcrumb');
            if (!breadcrumb) return;
            
            let html = '<span class="breadcrumb-item" onclick="navigateToFolder(\'\')">Documents</span>';
            
            if (currentPath) {
                const pathParts = currentPath.split('/');
                let buildPath = '';
                
                pathParts.forEach((part, index) => {
                    buildPath += (index > 0 ? '/' : '') + part;
                    html += ` <span style="color: #9ca3af;">→</span> <span class="breadcrumb-item" onclick="navigateToFolder('${buildPath}')">${part}</span>`;
                });
            }
            
            breadcrumb.innerHTML = html;
        }

        function renderItems() {
            const container = document.getElementById('itemsContainer');
            if (!container) return;
            
            let items = Object.values(fileSystem).filter(item => {
                if (item.parentPath !== currentPath) return false;
                
                if (selectedType !== 'All Types') {
                    if (selectedType === 'Folders' && item.type !== 'folder') return false;
                    if (selectedType === 'Documents' && (item.type !== 'file' || !['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(item.name.toLowerCase().split('.').pop()))) return false;
                    if (selectedType === 'Images' && (item.type !== 'file' || !['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(item.name.toLowerCase().split('.').pop()))) return false;
                }
                
                return true;
            });

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><i class="fa-solid fa-folder"></i></div>
                        <h3>No files or folders yet</h3>
                        <p>Create a folder or upload some files to get started</p>
                    </div>
                `;
                return;
            }

            items.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            let html = '';

            items.forEach(item => {
                const isFolder = item.type === 'folder';
                const fileType = isFolder ? { icon: '📁', class: 'folder-icon', type: 'folder' } : getFileType(item.name);
                const dateStr = item.created.toLocaleDateString();
                const sizeStr = isFolder ? '—' : formatFileSize(item.size);
                const clickAction = isFolder ? `navigateToFolder('${item.path}')` : `openFile('${item.path}')`;
                const attachmentIndicator = item.isAttachment ? ' 📎' : '';

                if (currentView === 'list') {
                    html += `
                        <div class="list-item" onclick="${clickAction}" oncontextmenu="showContextMenu(event, '${item.path}')">
                            <div class="item-icon ${fileType.class}">${fileType.icon}</div>
                            <div class="item-info">
                                <div class="item-name">${item.name}${attachmentIndicator}</div>
                                <div class="item-meta">Modified: ${dateStr}</div>
                            </div>
                            <div class="item-size">${sizeStr}</div>
                            <div class="item-actions">
                                <button class="action-btn" onclick="event.stopPropagation(); renameItemDirect('${item.path}')" title="Rename">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="action-btn danger" onclick="event.stopPropagation(); deleteItemDirect('${item.path}')" title="Delete">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    const previewClass = isFolder ? 'folder' : fileType.type;
                    const previewIcon = isFolder ? '📁' : fileType.icon;
                    
                    html += `
                        <div class="grid-item" onclick="${clickAction}" oncontextmenu="showContextMenu(event, '${item.path}')">
                            <div class="item-preview ${previewClass}">
                                <div class="preview-icon">${previewIcon}</div>
                            </div>
                            <div class="item-info">
                                <div class="item-name">${item.name}${attachmentIndicator}</div>
                                <div class="item-meta">${sizeStr}</div>
                            </div>
                        </div>
                    `;
                }
            });

            container.innerHTML = html;
        }

        function renameItemDirect(itemPath) {
            contextItem = itemPath;
            renameItem();
        }

        function deleteItemDirect(itemPath) {
            contextItem = itemPath;
            deleteItem();
        }

        function openFile(filePath) {
            const file = fileSystem[filePath];
            if (file && file.file) {
                const url = URL.createObjectURL(file.file);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
                if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
                    window.showAlert('File cannot be opened', 'error');
                } else {
                    alert('File cannot be opened');
                }
            }
        }

        function showNotification(message, type = 'info') {
            // Remove existing notifications
            const existingNotifications = document.querySelectorAll('.notification');
            existingNotifications.forEach(n => n.remove());
            
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 18px;">${getNotificationIcon(type)}</span>
                    <span style="flex: 1;">${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; opacity: 0.7; padding: 4px;">×</button>
                </div>
            `;
            
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${getNotificationColor(type)};
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 2000;
                transform: translateX(400px);
                transition: all 0.3s ease;
                max-width: 400px;
                backdrop-filter: blur(20px);
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }

        function getNotificationIcon(type) {
            switch (type) {
                case 'success': return '✅';
                case 'error': return '❌';
                case 'warning': return '⚠️';
                default: return 'ℹ️';
            }
        }

        function getNotificationColor(type) {
            switch (type) {
                case 'success': return 'linear-gradient(135deg, #10b981, #059669)';
                case 'error': return 'linear-gradient(135deg, #ef4444, #dc2626)';
                case 'warning': return 'linear-gradient(135deg, #f59e0b, #d97706)';
                default: return 'linear-gradient(135deg, #667eea, #764ba2)';
            }
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const visibleModal = document.querySelector('.modal.show');
                if (visibleModal) {
                    closeModal(visibleModal.id);
                }
                
                const contextMenu = document.getElementById('contextMenu');
                if (contextMenu && contextMenu.style.display === 'block') {
                    contextMenu.style.display = 'none';
                }
            }
            
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                showNewFolderModal();
            }
            
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                showUploadModal();
            }
        });