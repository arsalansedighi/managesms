document.getElementById('no_send').addEventListener('change', function() {
    const messageInput = document.getElementById('message');
    if (this.checked) {
        // اگر تیک خورده بود، required رو بردار
        messageInput.removeAttribute('required');
    } else {
        // اگر تیک نخورده بود، required باشه
        messageInput.setAttribute('required', 'required');
    }
});
document.querySelector('form').addEventListener('submit', function(e) {
    const groupId = document.getElementById('group_id').value.trim();
    if (!groupId) {
        e.preventDefault();
        alert("لطفاً نوع فعالیت را انتخاب کنید.");
        // یا نمایش پیغام به صورت بهتر در صفحه
    }
});
function showReadyMessagesModal() {
    new bootstrap.Modal(document.getElementById('readyMessagesModal')).show();
    loadReadyMessages();
}

function loadReadyMessages() {
    const list = document.getElementById('readyMessagesList');
    list.innerHTML = `<ul class="list-group"><li class="list-group-item text-muted">در حال بارگذاری...</li></ul>`;

    fetch('/api/ready-messages')
        .then(res => res.json())
        .then(data => {
            if(data.length === 0) {
                list.innerHTML = `<ul class="list-group"><li class="list-group-item text-muted">هیچ پیام آماده‌ای ثبت نشده است.</li></ul>`;
            } else {
                const ul = document.createElement('ul');
                ul.className = 'list-group';
                data.forEach(msg => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-center align-items-center';

                    // عنوان وسط و قابل کلیک برای انتخاب پیام
                    const span = document.createElement('span');
                    span.className = 'flex-grow-1 text-center';
                    span.style.cursor = 'pointer';
                    span.textContent = msg.title;
                    span.onclick = () => {
                        selectReadyMessage(msg.body);
                    };

                    // دکمه حذف سمت راست با فاصله
                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-sm btn-danger ms-2';
                    delBtn.textContent = '🗑️';
                    delBtn.onclick = (e) => {
                        e.stopPropagation(); // جلوگیری از انتخاب پیام هنگام کلیک حذف
                        deleteReadyMessage(msg.id);
                    };

                    li.appendChild(span);
                    li.appendChild(delBtn);
                    ul.appendChild(li);
                });
                list.innerHTML = '';
                list.appendChild(ul);
            }
        });
}
function selectReadyMessage(body) {
    document.getElementById('message').value = body;
    bootstrap.Modal.getInstance(document.getElementById('readyMessagesModal')).hide();
}

function submitNewReadyMessage() {
    const title = document.getElementById('newReadyMessageTitle').value.trim();
    const body = document.getElementById('newReadyMessageBody').value.trim();
    const msgDiv = document.getElementById('readyMessageMsg');
    msgDiv.textContent = '';

    if (!title || !body) {
        msgDiv.textContent = 'موضوع و متن پیام الزامی است.';
        msgDiv.className = 'text-danger';
        return;
    }

    fetch('/api/ready-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
    })
    .then(res => res.json())
    .then(data => {
        if (data.id) {
            msgDiv.textContent = 'پیام با موفقیت اضافه شد.';
            msgDiv.className = 'text-success';
            document.getElementById('newReadyMessageTitle').value = '';
            document.getElementById('newReadyMessageBody').value = '';
            loadReadyMessages(); // فقط جدول رو آپدیت کن، مودال رو باز نکن دوباره
        } else {
            msgDiv.textContent = data.message || 'خطا در افزودن پیام';
            msgDiv.className = 'text-danger';
        }
    });
}

function deleteReadyMessage(id) {
    if (confirm("آیا مطمئنید می‌خواهید این پیام را حذف کنید؟")) {
        fetch(`/api/ready-messages/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                loadReadyMessages(); // فقط جدول رو آپدیت کن
            });
    }
}

function showGroupModal() {
    const list = document.getElementById('groupList');
    list.innerHTML = `<li class="list-group-item text-muted">در حال بارگذاری...</li>`;
    fetch('/api/groups')
        .then(res => res.json())
        .then(data => {
            list.innerHTML = '';
            data.forEach(group => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                        <span class="mx-auto" style="cursor:pointer;" onclick="selectGroup(${group.id}, '${group.group}')">${group.group}</span>
                        <button class="btn btn-sm btn-danger ms-auto" onclick="deleteGroup(${group.id})">🗑️</button>
                    `;
                list.appendChild(li);
            });
        });
    new bootstrap.Modal(document.getElementById('groupModal')).show();
}

function selectGroup(id, name) {
    document.getElementById('group_id').value = id;
    document.getElementById('selectedGroup').innerText = name;
    bootstrap.Modal.getInstance(document.getElementById('groupModal')).hide();
}

function submitNewGroup() {
    const input = document.getElementById('newGroupInput');
    const name = input.value.trim();
    const msgDiv = document.getElementById('groupMsg');
    msgDiv.textContent = '';
    if (!name) {
        msgDiv.textContent = 'نام گروه الزامی است.';
        msgDiv.className = 'text-danger';
        return;
    }
    fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: name })
    })
    .then(res => res.json())
    .then(data => {
        msgDiv.textContent = 'گروه با موفقیت اضافه شد.';
        msgDiv.className = 'text-success';
        input.value = '';
        bootstrap.Modal.getInstance(document.getElementById('groupModal')).hide();
        setTimeout(showGroupModal, 300);
    });
}
function deleteGroup(id) {
    if (confirm("آیا مطمئنید می‌خواهید این گروه را حذف کنید؟")) {
        fetch(`/api/groups/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                bootstrap.Modal.getInstance(document.getElementById('groupModal')).hide();
                setTimeout(showGroupModal, 300);
            });
    }
}
function showAddReadyMessageModal() {
    // نمایش مودال افزودن پیام جدید
    new bootstrap.Modal(document.getElementById('addReadyMessageModal')).show();
    // پاک کردن پیام‌ها و ورودی‌ها
    document.getElementById('newReadyMessageTitle').value = '';
    document.getElementById('newReadyMessageBody').value = '';
    document.getElementById('readyMessageAddMsg').textContent = '';
}

function submitNewReadyMessage() {
    const title = document.getElementById('newReadyMessageTitle').value.trim();
    const body = document.getElementById('newReadyMessageBody').value.trim();
    const msgDiv = document.getElementById('readyMessageAddMsg');
    msgDiv.textContent = '';

    if (!title || !body) {
        msgDiv.textContent = 'موضوع و متن پیام الزامی است.';
        msgDiv.className = 'text-danger';
        return;
    }

    fetch('/api/ready-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
    })
    .then(res => res.json())
    .then(data => {
        if (data.id) {
            msgDiv.textContent = 'پیام با موفقیت اضافه شد.';
            msgDiv.className = 'text-success';
            // بستن مودال بعد از اضافه شدن موفق
            bootstrap.Modal.getInstance(document.getElementById('addReadyMessageModal')).hide();
            // رفرش کردن لیست پیام‌ها داخل مودال اصلی
            loadReadyMessages();
        } else {
            msgDiv.textContent = data.message || 'خطا در افزودن پیام';
            msgDiv.className = 'text-danger';
        }
    });
}

