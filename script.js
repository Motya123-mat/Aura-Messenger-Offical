// ==================== GLOBAL VARIABLES ====================
let db = null;
let currentUser = null;
let currentSection = 'feed';
let lastPostTime = 0;
const POST_COOLDOWN = 5 * 60 * 1000; // 5 минут
const MAX_WARNINGS = 3;
const BAN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 дней
const MUTE_DURATION = 60 * 60 * 1000; // 1 час

// ==================== DATABASE ====================
function initDB() {
    console.log('Initializing database...');
    
    try {
        const saved = localStorage.getItem('auraMessengerDB');
        
        if (saved) {
            db = JSON.parse(saved);
            
            if (!validateAndFixDB()) {
                console.error('Database validation failed, creating fresh DB');
                createFreshDB();
            }
        } else {
            console.log('No saved database found, creating fresh DB');
            createFreshDB();
        }
        
        console.log('Database initialized successfully');
        return true;
    } catch (e) {
        console.error('Error initializing database:', e);
        createFreshDB();
        return true;
    }
}

function validateAndFixDB() {
    if (!db) return false;
    
    // Проверяем наличие всех необходимых массивов
    const requiredArrays = ['users', 'posts', 'clans', 'warnings', 'securityLogs'];
    for (const arr of requiredArrays) {
        if (!Array.isArray(db[arr])) {
            console.warn(`Missing or invalid array: ${arr}, creating new one`);
            db[arr] = [];
        }
    }
    
    // Проверяем настройки системы
    if (!db.systemSettings) {
        db.systemSettings = {
            registrationEnabled: true,
            maxPostsPerUser: 100,
            maxCommentsPerPost: 50,
            antiSpamEnabled: true,
            maxLoginAttempts: 5,
            maintenanceMode: false
        };
    }
    
    saveDB();
    return true;
}

function createFreshDB() {
    console.log('Creating fresh database...');
    
    db = {
        users: [
            {
                id: 'admin_' + Date.now(),
                name: 'Администратор',
                username: 'admin',
                password: 'admin123',
                email: 'admin@auramessenger.com',
                avatar: 'https://via.placeholder.com/150/6366f1/ffffff?text=ADMIN',
                verified: true,
                isOfficial: true,
                isYoutuber: false,
                isAdmin: true,
                isOwner: false,
                banned: false,
                bannedUntil: null,
                muted: false,
                mutedUntil: null,
                warnings: 0,
                postsCount: 0,
                clanId: null,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                securityLevel: 10
            },
            {
                id: 'owner_' + Date.now(),
                name: 'Владелец',
                username: 'owner',
                password: 'owner123',
                email: 'owner@auramessenger.com',
                avatar: 'https://via.placeholder.com/150/f43f5e/ffffff?text=OWNER',
                verified: true,
                isOfficial: true,
                isYoutuber: true,
                isAdmin: true,
                isOwner: true,
                banned: false,
                bannedUntil: null,
                muted: false,
                mutedUntil: null,
                warnings: 0,
                postsCount: 0,
                clanId: null,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                securityLevel: 100
            }
        ],
        posts: [],
        clans: [],
        warnings: [],
        securityLogs: [],
        systemSettings: {
            registrationEnabled: true,
            maxPostsPerUser: 100,
            maxCommentsPerPost: 50,
            antiSpamEnabled: true,
            maxLoginAttempts: 5,
            maintenanceMode: false
        }
    };
    
    saveDB();
    console.log('Fresh database created');
}

function saveDB() {
    try {
        localStorage.setItem('auraMessengerDB', JSON.stringify(db));
        console.log('Database saved successfully');
    } catch (e) {
        console.error('Error saving database:', e);
        showMessage('Ошибка сохранения данных. Очистите кэш браузера.', 'error');
    }
}

// ==================== AUTHENTICATION ====================
function checkAuth() {
    console.log('Checking authentication...');
    
    try {
        const savedUser = localStorage.getItem('currentUser');
        
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            console.log('Loaded user from localStorage:', currentUser.username);
            
            const user = db.users.find(u => u.id === currentUser.id);
            
            if (!user) {
                console.warn('User not found in database, clearing session');
                currentUser = null;
                localStorage.removeItem('currentUser');
                enableGuestMode();
                return false;
            }
            
            // Проверяем бан и мут
            if (user.banned && user.bannedUntil && Date.now() < user.bannedUntil) {
                const remainingDays = Math.ceil((user.bannedUntil - Date.now()) / (24 * 60 * 60 * 1000));
                showMessage(`Ваш аккаунт забанен на ${remainingDays} дней`, 'error');
                logout();
                enableGuestMode();
                return false;
            } else if (user.banned) {
                // Срок бана истек
                user.banned = false;
                user.bannedUntil = null;
            }
            
            if (user.muted && user.mutedUntil && Date.now() < user.mutedUntil) {
                const remainingMinutes = Math.ceil((user.mutedUntil - Date.now()) / (60 * 1000));
                showMessage(`Вы замучены на ${remainingMinutes} минут`, 'warning');
            } else if (user.muted) {
                user.muted = false;
                user.mutedUntil = null;
            }
            
            // Обновляем данные пользователя
            currentUser = {
                id: user.id,
                name: user.name,
                username: user.username,
                password: user.password,
                email: user.email,
                avatar: user.avatar,
                verified: user.verified,
                isOfficial: user.isOfficial,
                isYoutuber: user.isYoutuber,
                isAdmin: user.isAdmin,
                isOwner: user.isOwner,
                banned: user.banned,
                bannedUntil: user.bannedUntil,
                muted: user.muted,
                mutedUntil: user.mutedUntil,
                warnings: user.warnings,
                postsCount: user.postsCount,
                clanId: user.clanId,
                securityLevel: user.securityLevel
            };
            
            user.lastLogin = Date.now();
            saveDB();
            
            // Обновляем UI
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('userNameDisplay').textContent = currentUser.name;
            
            if (currentUser.isAdmin || currentUser.isOwner) {
                document.getElementById('adminBtn').style.display = 'block';
            }
            
            enableUserMode();
            loadProfile();
            loadPosts();
            
            document.getElementById('authModal').style.display = 'none';
            document.querySelector('main').style.display = 'block';
            
            console.log('Authentication successful');
            return true;
        } else {
            console.log('No saved user found');
            enableGuestMode();
            document.getElementById('authModal').style.display = 'flex';
            return false;
        }
    } catch (e) {
        console.error('Error checking auth:', e);
        currentUser = null;
        localStorage.removeItem('currentUser');
        enableGuestMode();
        document.getElementById('authModal').style.display = 'flex';
        return false;
    }
}

function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    console.log('Login attempt:', username);
    
    if (!username || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Проверяем бан
        if (user.banned) {
            if (user.bannedUntil && Date.now() < user.bannedUntil) {
                const remainingDays = Math.ceil((user.bannedUntil - Date.now()) / (24 * 60 * 60 * 1000));
                showMessage(`Аккаунт забанен на ${remainingDays} дней`, 'error');
                return;
            } else {
                user.banned = false;
                user.bannedUntil = null;
            }
        }
        
        // Проверяем мут
        if (user.muted && user.mutedUntil && Date.now() < user.mutedUntil) {
            const remainingMinutes = Math.ceil((user.mutedUntil - Date.now()) / (60 * 1000));
            showMessage(`Аккаунт замучен на ${remainingMinutes} минут`, 'warning');
        } else if (user.muted) {
            user.muted = false;
            user.mutedUntil = null;
        }
        
        currentUser = {
            id: user.id,
            name: user.name,
            username: user.username,
            password: user.password,
            email: user.email,
            avatar: user.avatar,
            verified: user.verified,
            isOfficial: user.isOfficial,
            isYoutuber: user.isYoutuber,
            isAdmin: user.isAdmin,
            isOwner: user.isOwner,
            banned: user.banned,
            bannedUntil: user.bannedUntil,
            muted: user.muted,
            mutedUntil: user.mutedUntil,
            warnings: user.warnings,
            postsCount: user.postsCount,
            clanId: user.clanId,
            securityLevel: user.securityLevel
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        user.lastLogin = Date.now();
        saveDB();
        
        showMessage('Добро пожаловать, ' + currentUser.name + '!', 'success');
        
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        
        checkAuth();
    } else {
        showMessage('Неверный логин или пароль', 'error');
    }
}

function register() {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    console.log('Registration attempt:', username);
    
    // Проверяем, включена ли регистрация
    if (!db.systemSettings.registrationEnabled) {
        showMessage('Регистрация временно отключена', 'error');
        return;
    }
    
    if (!name || !username || !email || !password || !confirmPassword) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (name.length < 2) {
        showMessage('Имя должно быть не менее 2 символов', 'error');
        return;
    }
    
    if (username.length < 3) {
        showMessage('Юзернейм должен быть не менее 3 символов', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Неверный формат email', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('Пароль должен быть не менее 8 символов', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Пароли не совпадают', 'error');
        return;
    }
    
    if (db.users.some(u => u.username === username)) {
        showMessage('Юзернейм уже занят', 'error');
        return;
    }
    
    if (db.users.some(u => u.email === email)) {
        showMessage('Email уже зарегистрирован', 'error');
        return;
    }
    
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        username: username,
        password: password,
        email: email,
        avatar: 'https://via.placeholder.com/150/6366f1/ffffff?text=' + name.charAt(0).toUpperCase(),
        verified: false,
        isOfficial: false,
        isYoutuber: false,
        isAdmin: false,
        isOwner: false,
        banned: false,
        bannedUntil: null,
        muted: false,
        mutedUntil: null,
        warnings: 0,
        postsCount: 0,
        clanId: null,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        securityLevel: 1
    };
    
    db.users.push(newUser);
    saveDB();
    
    showMessage('Регистрация успешна! Теперь войдите в систему.', 'success');
    switchTab('login');
    
    document.getElementById('regName').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function logout() {
    console.log('Logging out user:', currentUser?.username);
    
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('userNameDisplay').textContent = '';
    document.getElementById('adminBtn').style.display = 'none';
    
    enableGuestMode();
    document.getElementById('authModal').style.display = 'flex';
    document.querySelector('main').style.display = 'none';
    
    showMessage('Вы вышли из системы', 'success');
}

// ==================== MODE MANAGEMENT ====================
function enableUserMode() {
    console.log('Enabling user mode');
    
    const elements = [
        { id: 'postContent', enabled: !(currentUser?.muted && currentUser?.mutedUntil && Date.now() < currentUser.mutedUntil) },
        { id: 'createPostButton', enabled: !(currentUser?.muted && currentUser?.mutedUntil && Date.now() < currentUser.mutedUntil) },
        { id: 'editName', enabled: true },
        { id: 'editUsername', enabled: true },
        { id: 'editEmail', enabled: true },
        { id: 'saveProfileButton', enabled: true },
        { id: 'avatarInput', enabled: true },
        { id: 'changePasswordButton', enabled: true },
        { id: 'createClanBtn', enabled: true },
        { id: 'joinClanBtn', enabled: true }
    ];
    
    elements.forEach(element => {
        const el = document.getElementById(element.id);
        if (el) {
            el.disabled = !element.enabled;
        }
    });
    
    // Обновляем текст кулдауна
    updatePostCooldown();
}

function enableGuestMode() {
    console.log('Enabling guest mode');
    
    const disabledElements = [
        'postContent', 'createPostButton', 'editName', 'editUsername', 'editEmail',
        'saveProfileButton', 'avatarInput', 'changePasswordButton',
        'createClanBtn', 'joinClanBtn'
    ];
    
    disabledElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
}

// ==================== UI FUNCTIONS ====================
function showSection(section) {
    console.log('Showing section:', section);
    
    // Если пользователь не авторизован, показываем только ленту
    if (!currentUser && section !== 'feed') {
        showMessage('Сначала войдите в систему', 'error');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    
    // Проверяем доступ к админке
    if (section === 'admin' && (!currentUser || (!currentUser.isAdmin && !currentUser.isOwner))) {
        showMessage('Нет доступа к админ панели', 'error');
        return;
    }
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    switch (section) {
        case 'feed':
            document.getElementById('feedBtn').classList.add('active');
            loadPosts();
            break;
        case 'profile':
            document.getElementById('profileBtn').classList.add('active');
            loadProfile();
            break;
        case 'messages':
            document.getElementById('messagesBtn').classList.add('active');
            break;
        case 'clans':
            document.getElementById('clansBtn').classList.add('active');
            loadClans();
            break;
        case 'admin':
            document.getElementById('adminBtn').classList.add('active');
            loadAdminPanel('users');
            break;
    }
    
    currentSection = section;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    if (tab === 'login') {
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('loginTabBtn').classList.add('active');
    } else {
        document.getElementById('registerTab').classList.add('active');
        document.getElementById('registerTabBtn').classList.add('active');
    }
}

function showMessage(message, type = 'success') {
    const existing = document.querySelector('.status-message');
    if (existing) existing.remove();
    
    const div = document.createElement('div');
    div.className = `status-${type} status-message`;
    
    div.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'fadeOut 0.5s';
        setTimeout(() => {
            if (div.parentNode) {
                div.parentNode.removeChild(div);
            }
        }, 500);
    }, 2500);
}

function updatePostCooldown() {
    const cooldownElement = document.getElementById('postCooldown');
    if (!cooldownElement || !currentUser) return;
    
    const now = Date.now();
    const timeSinceLastPost = now - lastPostTime;
    
    if (timeSinceLastPost < POST_COOLDOWN) {
        const remainingMinutes = Math.ceil((POST_COOLDOWN - timeSinceLastPost) / 60000);
        cooldownElement.textContent = `Подождите ${remainingMinutes} минут перед следующим постом`;
        cooldownElement.style.color = 'var(--danger)';
    } else {
        cooldownElement.textContent = 'Можно публиковать';
        cooldownElement.style.color = 'var(--success)';
    }
}

// ==================== POSTS ====================
function loadPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    container.innerHTML = '<p class="loading-text">Загрузка постов...</p>';
    
    setTimeout(() => {
        container.innerHTML = '';
        
        if (db.posts.length === 0) {
            container.innerHTML = '<p class="no-posts"><i class="fas fa-inbox"></i> Пока нет постов. Будь первым!</p>';
            return;
        }
        
        const sortedPosts = [...db.posts].sort((a, b) => b.timestamp - a.timestamp);
        
        sortedPosts.forEach(post => {
            const postElement = createPostElement(post);
            if (postElement) {
                container.appendChild(postElement);
            }
        });
    }, 300);
}

function createPostElement(post) {
    if (!post || !post.id) return null;
    
    const user = db.users.find(u => u.id === post.userId);
    if (!user) return null;
    
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.dataset.id = post.id;
    
    postCard.innerHTML = `
        <div class="post-header">
            <img src="${user.avatar}" class="post-avatar" alt="Avatar" onerror="this.src='https://via.placeholder.com/150/6366f1/ffffff?text=${user.name.charAt(0).toUpperCase()}'">
            <div class="post-info">
                <div class="post-username">
                    ${user.name}
                    ${user.verified ? '<i class="fas fa-check-circle post-verified" title="Верифицирован"></i>' : ''}
                    ${user.isOfficial ? '<span class="post-official" title="Официальный"><i class="fas fa-certificate"></i></span>' : ''}
                    ${user.isYoutuber ? '<span class="post-youtuber" title="Ютубер"><i class="fab fa-youtube"></i></span>' : ''}
                    ${user.isOwner ? '<span class="post-owner-badge"><i class="fas fa-crown"></i> Владелец</span>' : ''}
                </div>
                <span class="post-time">${formatTime(post.timestamp)}</span>
            </div>
        </div>
        <div class="post-content">${post.content.replace(/\n/g, '<br>')}</div>
    `;
    
    return postCard;
}

function createPost() {
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    
    // Проверяем мут
    if (currentUser.muted && currentUser.mutedUntil && Date.now() < currentUser.mutedUntil) {
        const remainingMinutes = Math.ceil((currentUser.mutedUntil - Date.now()) / 60000);
        showMessage(`Вы замучены на ${remainingMinutes} минут`, 'error');
        return;
    }
    
    const now = Date.now();
    if (now - lastPostTime < POST_COOLDOWN) {
        const remainingMinutes = Math.ceil((POST_COOLDOWN - (now - lastPostTime)) / 60000);
        showMessage(`Подождите ${remainingMinutes} минут перед следующим постом`, 'error');
        return;
    }
    
    const content = document.getElementById('postContent').value.trim();
    
    if (!content) {
        showMessage('Напишите что-нибудь', 'error');
        return;
    }
    
    // Проверяем анти-спам
    if (db.systemSettings.antiSpamEnabled) {
        const userPosts = db.posts.filter(p => p.userId === currentUser.id);
        const recentPosts = userPosts.filter(p => now - p.timestamp < 60000); // Посты за последнюю минуту
        
        if (recentPosts.length >= 3) {
            showMessage('Слишком много постов за короткое время', 'error');
            return;
        }
    }
    
    const newPost = {
        id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: content,
        userId: currentUser.id,
        timestamp: Date.now()
    };
    
    db.posts.unshift(newPost);
    
    const user = db.users.find(u => u.id === currentUser.id);
    if (user) {
        user.postsCount = (user.postsCount || 0) + 1;
    }
    
    saveDB();
    
    document.getElementById('postContent').value = '';
    lastPostTime = Date.now();
    updatePostCooldown();
    
    loadPosts();
    showMessage('Пост опубликован!', 'success');
}

// ==================== PROFILE ====================
function loadProfile() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileUsername').textContent = '@' + currentUser.username;
    document.getElementById('profileAvatar').src = currentUser.avatar;
    document.getElementById('profilePosts').textContent = currentUser.postsCount || 0;
    
    const clan = db.clans.find(c => c.id === currentUser.clanId);
    document.getElementById('profileClan').textContent = clan ? `${clan.name} ${clan.tag}` : '-';
    
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editUsername').value = currentUser.username;
    document.getElementById('editEmail').value = currentUser.email || '';
    
    const userPostsDiv = document.getElementById('userPosts');
    if (!userPostsDiv) return;
    
    setTimeout(() => {
        const userPosts = db.posts.filter(p => p.userId === currentUser.id);
        if (userPosts.length === 0) {
            userPostsDiv.innerHTML = '<h3>Мои посты</h3><p class="loading-text">У вас пока нет постов</p>';
        } else {
            userPostsDiv.innerHTML = '<h3>Мои посты</h3>';
            const sortedPosts = [...userPosts].sort((a, b) => b.timestamp - a.timestamp);
            sortedPosts.forEach(post => {
                const postDiv = document.createElement('div');
                postDiv.className = 'user-post-item';
                postDiv.innerHTML = `
                    <div class="user-post-content">${post.content}</div>
                    <div class="user-post-time">${formatTime(post.timestamp)}</div>
                `;
                userPostsDiv.appendChild(postDiv);
            });
        }
    }, 300);
}

function saveProfile() {
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        return;
    }
    
    const newName = document.getElementById('editName').value.trim();
    const newUsername = document.getElementById('editUsername').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    
    if (!newName || !newUsername || !newEmail) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (newName.length < 2) {
        showMessage('Имя должно быть не менее 2 символов', 'error');
        return;
    }
    
    if (newUsername.length < 3) {
        showMessage('Юзернейм должен быть не менее 3 символов', 'error');
        return;
    }
    
    if (!validateEmail(newEmail)) {
        showMessage('Неверный формат email', 'error');
        return;
    }
    
    // Проверяем уникальность юзернейма
    if (newUsername !== currentUser.username && db.users.some(u => u.username === newUsername)) {
        showMessage('Юзернейм уже занят', 'error');
        return;
    }
    
    // Проверяем уникальность email
    if (newEmail !== currentUser.email && db.users.some(u => u.email === newEmail)) {
        showMessage('Email уже зарегистрирован', 'error');
        return;
    }
    
    currentUser.name = newName;
    currentUser.username = newUsername;
    currentUser.email = newEmail;
    
    const user = db.users.find(u => u.id === currentUser.id);
    if (user) {
        user.name = newName;
        user.username = newUsername;
        user.email = newEmail;
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    saveDB();
    
    loadProfile();
    showMessage('Профиль обновлен!', 'success');
}

function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    const file = input.files[0];
    
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        showMessage('Неверный формат файла. Разрешены: JPG, PNG, GIF', 'error');
        return;
    }
    
    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showMessage('Файл слишком большой. Максимальный размер: 5MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentUser.avatar = e.target.result;
        
        const user = db.users.find(u => u.id === currentUser.id);
        if (user) {
            user.avatar = e.target.result;
        }
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        saveDB();
        
        document.getElementById('profileAvatar').src = e.target.result;
        showMessage('Аватар обновлен!', 'success');
    };
    
    reader.onerror = function() {
        showMessage('Ошибка при загрузке файла', 'error');
    };
    
    reader.readAsDataURL(file);
    input.value = '';
}

function changePassword() {
    document.getElementById('changePasswordModal').style.display = 'flex';
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
}

function confirmChangePassword() {
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        return;
    }
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (!oldPassword || !newPassword || !confirmNewPassword) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (oldPassword !== currentUser.password) {
        showMessage('Неверный старый пароль', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showMessage('Новый пароль должен быть не менее 8 символов', 'error');
        return;
    }
    
    if (newPassword === oldPassword) {
        showMessage('Новый пароль должен отличаться от старого', 'error');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showMessage('Пароли не совпадают', 'error');
        return;
    }
    
    currentUser.password = newPassword;
    
    const user = db.users.find(u => u.id === currentUser.id);
    if (user) {
        user.password = newPassword;
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    saveDB();
    
    closeChangePasswordModal();
    showMessage('Пароль успешно изменен!', 'success');
}

// ==================== CLANS ====================
function loadClans() {
    const container = document.getElementById('clansContainer');
    if (!container) return;
    
    container.innerHTML = '<p class="loading-text">Загрузка кланов...</p>';
    
    setTimeout(() => {
        container.innerHTML = '';
        
        if (db.clans.length === 0) {
            container.innerHTML = '<p class="no-clans"><i class="fas fa-users-slash"></i> Пока нет кланов. Создай первый!</p>';
            return;
        }
        
        db.clans.forEach(clan => {
            const clanElement = createClanElement(clan);
            if (clanElement) {
                container.appendChild(clanElement);
            }
        });
    }, 300);
}

function createClanElement(clan) {
    if (!clan || !clan.id) return null;
    
    const memberCount = clan.members ? clan.members.length : 0;
    
    const clanCard = document.createElement('div');
    clanCard.className = 'clan-card';
    clanCard.dataset.id = clan.id;
    
    clanCard.innerHTML = `
        <div class="clan-header">
            <div>
                <span class="clan-name">${clan.name}</span>
                <span class="clan-tag">${clan.tag}</span>
            </div>
        </div>
        <div class="clan-description">${clan.description ? clan.description : '<span style="color:#9ca3af;font-style:italic;">Без описания</span>'}</div>
        <div class="clan-members">
            <i class="fas fa-users"></i>
            <span>${memberCount} участников</span>
        </div>
    `;
    
    return clanCard;
}

function showClanModal() {
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    
    if (currentUser.clanId) {
        showMessage('Вы уже состоите в клане', 'error');
        return;
    }
    
    document.getElementById('clanModal').style.display = 'flex';
}

function closeClanModal() {
    document.getElementById('clanModal').style.display = 'none';
    document.getElementById('clanName').value = '';
    document.getElementById('clanTag').value = '';
    document.getElementById('clanDescription').value = '';
}

function closeJoinClanModal() {
    document.getElementById('joinClanModal').style.display = 'none';
}

function showJoinClanModal() {
    if (!currentUser) {
        showMessage('Сначала войдите в систему', 'error');
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    
    if (currentUser.clanId) {
        showMessage('Вы уже состоите в клане', 'error');
        return;
    }
    
    document.getElementById('joinClanModal').style.display = 'flex';
    loadClanList();
}

function loadClanList() {
    const clanList = document.getElementById('clanList');
    clanList.innerHTML = '<option value="">Выберите клан</option>';
    
    db.clans.forEach(clan => {
        const option = document.createElement('option');
        option.value = clan.id;
        option.textContent = `${clan.name} ${clan.tag}`;
        clanList.appendChild(option);
    });
}

function createClan() {
    const name = document.getElementById('clanName').value.trim();
    const tag = document.getElementById('clanTag').value.trim();
    const description = document.getElementById('clanDescription').value.trim();
    
    if (!name || !tag) {
        showMessage('Заполните название и тег', 'error');
        return;
    }
    
    if (name.length < 3) {
        showMessage('Название должно быть не менее 3 символов', 'error');
        return;
    }
    
    if (!tag.startsWith('@')) {
        showMessage('Тег должен начинаться с @', 'error');
        return;
    }
    
    if (tag.length < 2) {
        showMessage('Тег должен содержать минимум 2 символа', 'error');
        return;
    }
    
    if (db.clans.some(c => c.tag === tag)) {
        showMessage('Тег уже занят', 'error');
        return;
    }
    
    if (db.clans.some(c => c.name === name)) {
        showMessage('Название клана уже занято', 'error');
        return;
    }
    
    const newClan = {
        id: 'clan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        tag: tag,
        description: description,
        leaderId: currentUser.id,
        leaderName: currentUser.name,
        members: [
            {
                id: currentUser.id,
                name: currentUser.name,
                role: 'leader'
            }
        ],
        createdAt: Date.now()
    };
    
    db.clans.push(newClan);
    
    const user = db.users.find(u => u.id === currentUser.id);
    if (user) {
        user.clanId = newClan.id;
    }
    
    saveDB();
    closeClanModal();
    loadClans();
    loadProfile();
    showMessage('Клан успешно создан!', 'success');
}

function joinClan() {
    const clanId = document.getElementById('clanList').value;
    
    if (!clanId) {
        showMessage('Выберите клан', 'error');
        return;
    }
    
    const clan = db.clans.find(c => c.id === clanId);
    if (!clan) {
        showMessage('Клан не найден', 'error');
        return;
    }
    
    if (currentUser.clanId) {
        showMessage('Вы уже состоите в клане', 'error');
        return;
    }
    
    // Проверяем, не состоит ли пользователь уже в этом клане
    if (clan.members.some(m => m.id === currentUser.id)) {
        showMessage('Вы уже состоите в этом клане', 'error');
        return;
    }
    
    clan.members.push({
        id: currentUser.id,
        name: currentUser.name,
        role: 'member'
    });
    
    const user = db.users.find(u => u.id === currentUser.id);
    if (user) {
        user.clanId = clanId;
    }
    
    saveDB();
    closeJoinClanModal();
    loadClans();
    loadProfile();
    showMessage('Вы вступили в клан!', 'success');
}

// ==================== ADMIN PANEL ====================
function loadAdminPanel(tab) {
    if (!currentUser || (!currentUser.isAdmin && !currentUser.isOwner)) {
        showMessage('Нет доступа к админ панели', 'error');
        return;
    }
    
    showAdminTab(tab);
}

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    
    const tabButton = document.getElementById(tabName + 'TabBtn');
    if (tabButton) {
        tabButton.classList.add('active');
    }
    
    const content = document.getElementById('adminContent');
    if (!content) return;
    
    content.innerHTML = '<p class="loading-text">Загрузка...</p>';
    
    setTimeout(() => {
        if (tabName === 'users') {
            content.innerHTML = generateUsersTable();
        } else if (tabName === 'posts') {
            content.innerHTML = generatePostsTable();
        } else if (tabName === 'warnings') {
            content.innerHTML = generateWarningsTable();
        } else if (tabName === 'security') {
            content.innerHTML = generateSecurityTable();
        }
    }, 300);
}

function generateUsersTable() {
    if (db.users.length === 0) {
        return '<p style="padding:25px;color:var(--gray);">Нет пользователей</p>';
    }
    
    let html = '<div class="admin-users-list">';
    
    const sortedUsers = [...db.users].sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return b.createdAt - a.createdAt;
    });
    
    sortedUsers.forEach(user => {
        const isBanned = user.banned && user.bannedUntil && Date.now() < user.bannedUntil;
        const isMuted = user.muted && user.mutedUntil && Date.now() < user.mutedUntil;
        
        html += `
            <div class="admin-user-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        <img src="${user.avatar}" alt="Avatar" onerror="this.src='https://via.placeholder.com/150/6366f1/ffffff?text=${user.name.charAt(0).toUpperCase()}'">
                        ${user.name} <span>@${user.username}</span>
                        ${user.verified ? '<i class="fas fa-check-circle admin-user-badge"></i>' : ''}
                        ${user.isOfficial ? '<span class="badge-official">OFFICIAL</span>' : ''}
                        ${user.isYoutuber ? '<span class="badge-youtuber">YOUTUBER</span>' : ''}
                        ${user.isOwner ? '<span class="badge-owner">ВЛАДЕЛЕЦ</span>' : ''}
                        ${user.isAdmin && !user.isOwner ? '<span class="badge-admin">АДМИН</span>' : ''}
                        ${isBanned ? '<span class="badge-banned">ЗАБАНЕН</span>' : ''}
                        ${isMuted ? '<span class="badge-muted">ЗАМУЧЕН</span>' : ''}
                    </div>
                    <div class="admin-user-stats">
                        <span><i class="fas fa-gem"></i> Постов: <strong>${user.postsCount || 0}</strong></span>
                        <span><i class="fas fa-exclamation-triangle"></i> Предупреждений: <strong>${user.warnings || 0}</strong></span>
                        ${user.email ? `<span><i class="fas fa-envelope"></i> ${user.email}</span>` : ''}
                    </div>
                </div>
                <div class="admin-actions">
                    ${!user.isOwner ? `
                        <button onclick="toggleVerify('${user.id}')" class="admin-btn ${user.verified ? 'admin-btn-warning' : 'admin-btn-verify'}" title="${user.verified ? 'Снять верификацию' : 'Выдать верификацию'}">
                            ${user.verified ? '<i class="fas fa-times"></i>' : '<i class="fas fa-check"></i>'}
                        </button>
                        <button onclick="toggleOfficial('${user.id}')" class="admin-btn ${user.isOfficial ? 'admin-btn-warning' : 'admin-btn-official'}" title="${user.isOfficial ? 'Снять официальный статус' : 'Выдать официальный статус'}">
                            ${user.isOfficial ? '<i class="fas fa-times"></i>' : '<i class="fas fa-certificate"></i>'}
                        </button>
                        <button onclick="toggleYoutuber('${user.id}')" class="admin-btn ${user.isYoutuber ? 'admin-btn-warning' : 'admin-btn-youtuber'}" title="${user.isYoutuber ? 'Снять статус ютубера' : 'Выдать статус ютубера'}">
                            ${user.isYoutuber ? '<i class="fas fa-times"></i>' : '<i class="fab fa-youtube"></i>'}
                        </button>
                        <button onclick="banUser('${user.id}')" class="admin-btn admin-btn-ban" title="${isBanned ? 'Разбанить' : 'Забанить'}">
                            <i class="fas fa-${isBanned ? 'unlock' : 'ban'}"></i>
                        </button>
                        <button onclick="muteUser('${user.id}')" class="admin-btn admin-btn-mute" title="${isMuted ? 'Размутить' : 'Замутить'}">
                            <i class="fas fa-${isMuted ? 'volume-up' : 'volume-mute'}"></i>
                        </button>
                        <button onclick="warnUser('${user.id}')" class="admin-btn admin-btn-warning" title="Выдать предупреждение">
                            <i class="fas fa-exclamation-triangle"></i> ${user.warnings}
                        </button>
                    ` : '<span class="protected-badge">ЗАЩИЩЕН</span>'}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function generatePostsTable() {
    if (db.posts.length === 0) {
        return '<p style="padding:25px;color:var(--gray);">Нет постов</p>';
    }
    
    let html = '<div class="admin-posts-list">';
    
    const sortedPosts = [...db.posts].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedPosts.forEach(post => {
        const user = db.users.find(u => u.id === post.userId);
        if (!user) return;
        
        html += `
            <div class="admin-post-card">
                <div class="admin-post-header">
                    <span>
                        <strong>${user.name}</strong> 
                        <span>@${user.username}</span>
                        ${user.verified ? '<i class="fas fa-check-circle"></i>' : ''}
                        ${user.isOfficial ? '<span class="badge-official">OFFICIAL</span>' : ''}
                        ${user.isYoutuber ? '<span class="badge-youtuber">YOUTUBER</span>' : ''}
                        ${user.isOwner ? '<span class="badge-owner">OWNER</span>' : ''}
                    </span>
                    <span class="post-time">${formatTime(post.timestamp)}</span>
                </div>
                <div class="admin-post-content">${post.content.replace(/\n/g, '<br>')}</div>
                <div class="admin-post-actions">
                    <button onclick="deletePost('${post.id}')" class="btn btn-danger">
                        <i class="fas fa-trash"></i> Удалить пост
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function generateWarningsTable() {
    if (db.warnings.length === 0) {
        return '<p style="padding:25px;color:var(--gray);">Нет предупреждений</p>';
    }
    
    let html = `
        <div class="admin-warnings-table">
            <table>
                <thead>
                    <tr>
                        <th>Пользователь</th>
                        <th>Админ</th>
                        <th>Дата</th>
                        <th>Тип</th>
                        <th>Причина</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const sortedWarnings = [...db.warnings].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedWarnings.forEach(warning => {
        const user = db.users.find(u => u.id === warning.userId);
        const admin = db.users.find(a => a.id === warning.adminId);
        
        html += `
            <tr>
                <td>${user ? `${user.name} @${user.username}` : 'Неизвестно'}</td>
                <td>${admin ? `${admin.name}` : 'Неизвестно'}</td>
                <td>${formatTime(warning.timestamp)}</td>
                <td>
                    <span class="warning-type warning-${warning.type}">
                        ${warning.type === 'ban' ? 'БАН' : 
                          warning.type === 'unban' ? 'РАЗБАН' : 
                          warning.type === 'mute' ? 'МУТ' : 
                          'ПРЕДУПРЕЖДЕНИЕ'}
                    </span>
                </td>
                <td>${warning.reason || 'Не указана'}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function generateSecurityTable() {
    const bannedUsers = db.users.filter(u => u.banned && u.bannedUntil && Date.now() < u.bannedUntil).length;
    const mutedUsers = db.users.filter(u => u.muted && u.mutedUntil && Date.now() < u.mutedUntil).length;
    
    let html = `
        <div class="security-panel">
            <h3>Система безопасности</h3>
            
            <div class="security-settings">
                <h4>Настройки защиты</h4>
                <div class="settings-grid">
                    <div class="setting-item">
                        <div class="setting-label">Анти-спам</div>
                        <div class="setting-value">${db.systemSettings.antiSpamEnabled ? '✅ Включен' : '❌ Выключен'}</div>
                    </div>
                    <div class="setting-item">
                        <div class="setting-label">Лимит входа</div>
                        <div class="setting-value">${db.systemSettings.maxLoginAttempts} попыток/минуту</div>
                    </div>
                    <div class="setting-item">
                        <div class="setting-label">Кулдаун постов</div>
                        <div class="setting-value">${POST_COOLDOWN / 60000} минут</div>
                    </div>
                </div>
            </div>
            
            <div class="security-stats">
                <h4>Статистика безопасности</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Логов безопасности</div>
                        <div class="stat-value">${db.securityLogs.length}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Забанено пользователей</div>
                        <div class="stat-value">${bannedUsers}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Замучено пользователей</div>
                        <div class="stat-value">${mutedUsers}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function toggleVerify(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя изменить верификацию владельца', 'error');
        return;
    }
    
    user.verified = !user.verified;
    saveDB();
    loadAdminPanel('users');
    showMessage(user.verified ? 'Верификация выдана' : 'Верификация снята', 'success');
}

function toggleOfficial(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя изменить статус владельца', 'error');
        return;
    }
    
    user.isOfficial = !user.isOfficial;
    saveDB();
    loadAdminPanel('users');
    showMessage(user.isOfficial ? 'Официальный статус выдан' : 'Официальный статус снят', 'success');
}

function toggleYoutuber(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя изменить статус владельца', 'error');
        return;
    }
    
    user.isYoutuber = !user.isYoutuber;
    saveDB();
    loadAdminPanel('users');
    showMessage(user.isYoutuber ? 'Статус ютубера выдан' : 'Статус ютубера снят', 'success');
}

function banUser(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя забанить владельца', 'error');
        return;
    }
    
    const action = user.banned ? 'разбанить' : 'забанить';
    const reason = prompt(`Причина ${action}а (необязательно):`);
    
    if (user.banned) {
        user.banned = false;
        user.bannedUntil = null;
        
        db.warnings.push({
            id: 'warning_' + Date.now(),
            userId: userId,
            userName: user.name,
            adminId: currentUser.id,
            adminName: currentUser.name,
            reason: reason || 'Разбан администратором',
            type: 'unban',
            timestamp: Date.now()
        });
        
        saveDB();
        loadAdminPanel('users');
        showMessage('Пользователь разбанен', 'success');
    } else {
        user.banned = true;
        user.bannedUntil = Date.now() + BAN_DURATION;
        
        db.warnings.push({
            id: 'warning_' + Date.now(),
            userId: userId,
            userName: user.name,
            adminId: currentUser.id,
            adminName: currentUser.name,
            reason: reason || 'Бан администратором на 30 дней',
            type: 'ban',
            timestamp: Date.now()
        });
        
        saveDB();
        loadAdminPanel('users');
        showMessage('Пользователь забанен на 30 дней', 'success');
    }
}

function muteUser(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя замутить владельца', 'error');
        return;
    }
    
    const action = user.muted ? 'размутить' : 'замутить';
    const duration = prompt(`Длительность мута в минутах (по умолчанию 60):`, '60');
    const minutes = parseInt(duration) || 60;
    
    if (isNaN(minutes) || minutes <= 0) {
        showMessage('Некорректная длительность', 'error');
        return;
    }
    
    if (user.muted) {
        user.muted = false;
        user.mutedUntil = null;
        
        db.warnings.push({
            id: 'warning_' + Date.now(),
            userId: userId,
            userName: user.name,
            adminId: currentUser.id,
            adminName: currentUser.name,
            reason: 'Размут администратором',
            type: 'unmute',
            timestamp: Date.now()
        });
        
        saveDB();
        loadAdminPanel('users');
        showMessage('Пользователь размучен', 'success');
    } else {
        user.muted = true;
        user.mutedUntil = Date.now() + minutes * 60 * 1000;
        
        db.warnings.push({
            id: 'warning_' + Date.now(),
            userId: userId,
            userName: user.name,
            adminId: currentUser.id,
            adminName: currentUser.name,
            reason: `Мут на ${minutes} минут`,
            type: 'mute',
            timestamp: Date.now()
        });
        
        saveDB();
        loadAdminPanel('users');
        showMessage(`Пользователь замучен на ${minutes} минут`, 'success');
    }
}

function warnUser(userId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        showMessage('Пользователь не найден', 'error');
        return;
    }
    
    if (user.isOwner) {
        showMessage('Нельзя выдать предупреждение владельцу', 'error');
        return;
    }
    
    const reason = prompt('Причина предупреждения (необязательно):');
    
    user.warnings = (user.warnings || 0) + 1;
    
    let message = '';
    if (user.warnings >= MAX_WARNINGS) {
        user.banned = true;
        user.bannedUntil = Date.now() + BAN_DURATION;
        message = `Пользователь получил ${MAX_WARNINGS} предупреждений и был автоматически забанен на 30 дней`;
    } else {
        message = `Предупреждение выдано (${user.warnings}/${MAX_WARNINGS})`;
    }
    
    db.warnings.push({
        id: 'warning_' + Date.now(),
        userId: userId,
        userName: user.name,
        adminId: currentUser.id,
        adminName: currentUser.name,
        reason: reason || 'Предупреждение администратором',
        type: 'warning',
        timestamp: Date.now()
    });
    
    saveDB();
    loadAdminPanel('users');
    showMessage(message, user.banned ? 'error' : 'success');
}

function deletePost(postId) {
    if (!currentUser?.isAdmin) {
        showMessage('Нет доступа', 'error');
        return;
    }
    
    if (!confirm('Удалить этот пост?')) return;
    
    const postIndex = db.posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
        db.posts.splice(postIndex, 1);
    }
    
    saveDB();
    loadPosts();
    showMessage('Пост удален', 'success');
}

// ==================== UTILITIES ====================
function formatTime(timestamp) {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // меньше минуты
            return 'только что';
        } else if (diff < 3600000) { // меньше часа
            const minutes = Math.floor(diff / 60000);
            return `${minutes} ${declension(minutes, ['минуту', 'минуты', 'минут'])} назад`;
        } else if (diff < 86400000) { // меньше суток
            const hours = Math.floor(diff / 3600000);
            return `${hours} ${declension(hours, ['час', 'часа', 'часов'])} назад`;
        } else {
            return date.toLocaleString('ru-RU', { 
                year: 'numeric', 
                month: 'numeric', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (e) {
        return 'Неизвестно';
    }
}

function declension(number, titles) {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
}

// ==================== INITIALIZE APP ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    if (initDB()) {
        checkAuth();
        loadPosts();
        loadClans();
        setupEventListeners();
        
        // Обновляем кулдаун каждую минуту
        setInterval(updatePostCooldown, 60000);
    }
});

function setupEventListeners() {
    // Header links
    document.getElementById('logoLink').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('feed');
    });
    
    // Navigation buttons
    document.getElementById('feedBtn').addEventListener('click', function() {
        showSection('feed');
    });
    document.getElementById('profileBtn').addEventListener('click', function() {
        showSection('profile');
    });
    document.getElementById('messagesBtn').addEventListener('click', function() {
        showSection('messages');
    });
    document.getElementById('clansBtn').addEventListener('click', function() {
        showSection('clans');
    });
    document.getElementById('adminBtn').addEventListener('click', function() {
        showSection('admin');
    });
    
    // Auth modal buttons
    document.getElementById('closeAuthModal').addEventListener('click', function() {
        if (!currentUser) {
            document.getElementById('authModal').style.display = 'flex';
        } else {
            document.getElementById('authModal').style.display = 'none';
        }
    });
    document.getElementById('loginTabBtn').addEventListener('click', function() {
        switchTab('login');
    });
    document.getElementById('registerTabBtn').addEventListener('click', function() {
        switchTab('register');
    });
    
    // Login button
    document.getElementById('loginButton').addEventListener('click', login);
    
    // Register button
    document.getElementById('registerButton').addEventListener('click', register);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Change password button
    document.getElementById('changePasswordButton').addEventListener('click', changePassword);
    
    // Close change password modal
    document.getElementById('closeChangePasswordModal').addEventListener('click', closeChangePasswordModal);
    
    // Confirm change password
    document.getElementById('confirmChangePasswordButton').addEventListener('click', confirmChangePassword);
    
    // Close clan modal
    document.getElementById('closeClanModal').addEventListener('click', closeClanModal);
    
    // Create clan button
    document.getElementById('createClanButtonModal').addEventListener('click', createClan);
    document.getElementById('createClanBtn').addEventListener('click', showClanModal);
    
    // Join clan buttons
    document.getElementById('closeJoinClanModal').addEventListener('click', closeJoinClanModal);
    document.getElementById('joinClanButtonModal').addEventListener('click', joinClan);
    document.getElementById('joinClanBtn').addEventListener('click', showJoinClanModal);
    
    // Admin tabs
    document.getElementById('usersTabBtn').addEventListener('click', function() {
        showAdminTab('users');
    });
    document.getElementById('postsTabBtn').addEventListener('click', function() {
        showAdminTab('posts');
    });
    document.getElementById('warningsTabBtn').addEventListener('click', function() {
        showAdminTab('warnings');
    });
    document.getElementById('securityTabBtn').addEventListener('click', function() {
        showAdminTab('security');
    });
    
    // Post actions
    document.getElementById('createPostButton').addEventListener('click', createPost);
    
    // Profile actions
    document.getElementById('saveProfileButton').addEventListener('click', saveProfile);
    document.getElementById('avatarUpload').addEventListener('click', function() {
        if (!currentUser) return;
        document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarInput').addEventListener('change', uploadAvatar);
    
    // Allow Enter key to submit login/register forms
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    document.getElementById('regConfirmPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') register();
    });
}