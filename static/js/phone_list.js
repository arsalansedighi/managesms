document.addEventListener('DOMContentLoaded', () => {

    // 🗓️ مقداردهی اولیه Persian Datepicker روی فیلد تاریخ پیگیری
    $("#follow_up_date").persianDatepicker({
        format: 'YYYY/MM/DD',
        autoClose: true,
        initialValue: false
    });

    // 📝 هندل فرم ثبت پیگیری
    const followUpForm = document.getElementById('followUpForm');
    followUpForm.addEventListener('submit', function (e) {
        e.preventDefault(); // جلوگیری از ریفرش فرم

        // استخراج مقادیر فرم
        const phoneId = document.getElementById('phone_id').value.trim();
        const description = document.getElementById('description').value.trim();
        const followUpTypeId = document.getElementById('follow_up_type_id').value;
        const followUpDatePersian = document.getElementById('follow_up_date').value.trim();
            let followUpDate = null;

            if (followUpDatePersian) {
                followUpDate = new persianDate(followUpDatePersian).toLocale('en').format('YYYY-MM-DD');
            }

        // اعتبارسنجی اولیه
        if (!phoneId || !description || !followUpTypeId) {
            alert('لطفاً همه فیلدهای ضروری را پر کنید.');
            return;
        }

        // ارسال داده به سرور
        fetch('/follow-up', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                phone_id: phoneId,
                description: description,
                follow_up_type_id: followUpTypeId,
                follow_up_date: followUpDate
            })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message || 'پیگیری با موفقیت ثبت شد');
            followUpForm.reset();
            bootstrap.Modal.getInstance(document.getElementById('followUpModal')).hide();
        })
        .catch(error => {
            alert('خطا در ثبت پیگیری');
            console.error(error);
        });
    });

    // ⚙️ دکمه مدیریت نوع‌های پیگیری
    const manageBtn = document.getElementById('manageFollowUpTypesBtn');
    manageBtn.addEventListener('click', () => {
        loadFollowUpTypes(); // بارگذاری لیست نوع‌ها
        new bootstrap.Modal(document.getElementById('manageFollowUpTypesModal')).show();
    });

    // 📥 بارگذاری لیست نوع پیگیری از سرور
    function loadFollowUpTypes() {
        const list = document.getElementById('followUpTypesList');
        list.innerHTML = '<li class="list-group-item">در حال بارگذاری...</li>';

        fetch('/api/follow-up-types')
            .then(res => res.json())
            .then(data => {
                list.innerHTML = '';
                if (data.length === 0) {
                    list.innerHTML = '<li class="list-group-item text-muted">هیچ نوع پیگیری ثبت نشده است.</li>';
                    return;
                }

                // ساخت ردیف‌های نوع پیگیری
                data.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.textContent = item.fallow_type;

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-sm btn-danger';
                    delBtn.textContent = 'حذف';

                    // حذف نوع پیگیری
                    delBtn.onclick = () => {
                        if (confirm(`آیا مطمئنید که می‌خواهید "${item.fallow_type}" را حذف کنید؟`)) {
                            fetch(`/api/follow-up-types/${item.id}`, { method: 'DELETE' })
                                .then(res => res.json())
                                .then(resData => {
                                    alert(resData.message);
                                    loadFollowUpTypes();
                                    updateFollowUpTypeSelector();
                                });
                        }
                    };

                    li.appendChild(delBtn);
                    list.appendChild(li);
                });
            })
            .catch(() => {
                list.innerHTML = '<li class="list-group-item text-danger">خطا در بارگذاری نوع پیگیری‌ها.</li>';
            });
    }

    // ➕ افزودن نوع پیگیری جدید
    document.getElementById('addFollowUpTypeBtn').addEventListener('click', () => {
        const input = document.getElementById('newFollowUpType');
        const val = input.value.trim();
        const msgDiv = document.getElementById('manageTypeMsg');
        msgDiv.textContent = '';

        if (!val) {
            msgDiv.textContent = 'لطفاً نوع پیگیری را وارد کنید.';
            msgDiv.className = 'text-danger';
            return;
        }

        fetch('/api/follow-up-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fallow_type: val })
        })
        .then(res => res.json())
        .then(data => {
            if (data.id) {
                msgDiv.textContent = 'نوع پیگیری با موفقیت اضافه شد.';
                msgDiv.className = 'text-success';
                input.value = '';
                loadFollowUpTypes();
                updateFollowUpTypeSelector();
            } else {
                msgDiv.textContent = data.message || 'خطا در افزودن نوع پیگیری';
                msgDiv.className = 'text-danger';
            }
        })
        .catch(() => {
            msgDiv.textContent = 'خطا در ارتباط با سرور.';
            msgDiv.className = 'text-danger';
        });
    });

    // 🔄 بروزرسانی لیست نوع پیگیری در فرم ثبت
    function updateFollowUpTypeSelector() {
        fetch('/api/follow-up-types')
            .then(res => res.json())
            .then(data => {
                const select = document.getElementById('follow_up_type_id');
                select.innerHTML = '<option value="">انتخاب کنید</option>';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.fallow_type;
                    select.appendChild(option);
                });
            });
    }

    // 👁️ نمایش پیگیری‌های ثبت‌شده برای شماره خاص
    window.showFollowUps = function(phoneId, phoneName) {
        document.getElementById('showFollowUpModalLabel').innerText = `پیگیری‌های مربوط به ${phoneName}`;
        const tbody = document.querySelector('#followUpTable tbody');

        tbody.innerHTML = `<tr><td colspan="4" class="text-muted">در حال بارگذاری...</td></tr>`;

        fetch(`/follow-ups/${phoneId}`)
            .then(response => response.json())
            .then(data => {
                if (data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">هیچ پیگیری ثبت نشده است.</td></tr>`;
                } else {
                    tbody.innerHTML = '';
                    data.forEach(item => {
                        const createdDate = new persianDate(new Date(item.created_at)).format('YYYY/MM/DD HH:mm');
                        const followUpDate = item.follow_up_date
                            ? new persianDate(item.follow_up_date.split('T')[0]).format('YYYY/MM/DD')
                            : '-';

                        const row = `
                            <tr>
                                <td>${createdDate}</td>
                                <td>${item.follow_up_type || '-'}</td>
                                <td class="text-break">${item.description}</td>
                                <td>${followUpDate}</td>
                            </tr>
                        `;
                        tbody.insertAdjacentHTML('beforeend', row);
                    });
                }

                new bootstrap.Modal(document.getElementById('showFollowUpModal')).show();
            })
            .catch(error => {
                tbody.innerHTML = `<tr><td colspan="4" class="text-danger">خطا در بارگذاری پیگیری‌ها.</td></tr>`;
                console.error(error);
            });
    }

    // ➕ باز کردن مودال پیگیری برای یک شماره خاص
    window.openFollowUpModal = function(phoneId, phoneName) {
        document.getElementById('phone_id').value = phoneId;
        document.getElementById('description').value = '';
        document.getElementById('follow_up_type_id').value = '';
        document.getElementById('followUpModalLabel').innerText = `پیگیری برای ${phoneName}`;
        new bootstrap.Modal(document.getElementById('followUpModal')).show();
    }

    // فراخوانی اولیه برای پر کردن لیست نوع پیگیری در فرم
    updateFollowUpTypeSelector();

});
