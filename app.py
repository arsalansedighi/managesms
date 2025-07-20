from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import hashlib
import config
import logging
from model import GroupingTable, PhoneTable, ManagmentTable, Fallow_up_type, ReadyMessage
from functions import Send_message
from datetime import datetime
from peewee import IntegrityError

# ساخت اپلیکیشن Flask
app = Flask(__name__)
app.secret_key = "your_secret_key"  # بهتر است در فایل env ذخیره شود و خوانده شود

# تابع هش کردن رمز عبور با الگوریتم SHA256
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# پیکربندی لاگینگ برای ثبت خطاها و اطلاعات در کنسول
logging.basicConfig(level=logging.DEBUG)

# مسیر ورود (و تغییر رمز) به سیستم
@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # بررسی ورود
        if "password" in request.form:
            password = request.form.get("password")
            if hash_password(password) == config.PASSWORD_HASH:
                session["authenticated"] = True
                return redirect(url_for("index"))
            else:
                return render_template("login.html", error="رمز ورود اشتباه است!")

        # بررسی تغییر رمز عبور
        if "old_password" in request.form:
            old_password = request.form["old_password"]
            if hash_password(old_password) != config.PASSWORD_HASH:
                error_message = "رمز عبور قدیمی اشتباه است!"
                return render_template("login.html", error=error_message)

            new_password = request.form["new_password"]
            confirm_new_password = request.form["confirm_new_password"]
            if new_password != confirm_new_password:
                error_message = "رمز عبور جدید و تایید آن یکسان نیستند!"
                return render_template("login.html", error=error_message)

            hashed = hash_password(new_password)

            # بازنویسی فایل config برای ذخیره رمز جدید
            try:
                with open("config.py", "r", encoding="utf-8") as f:
                    lines = f.readlines()

                with open("config.py", "w", encoding="utf-8") as f:
                    for line in lines:
                        if line.startswith("PASSWORD_HASH"):
                            f.write(f'PASSWORD_HASH = "{hashed}"\n')
                        else:
                            f.write(line)

                logging.info("رمز جدید با موفقیت در فایل config.py ذخیره شد.")
                success_message = "رمز عبور با موفقیت تغییر یافت. لطفاً وارد شوید."
                session.pop("authenticated", None)  # حذف نشست بعد از تغییر رمز
                return redirect(url_for("login"))

            except Exception as e:
                logging.error(f"خطا در نوشتن به فایل config.py: {e}")
                error_message = "مشکلی در ذخیره رمز جدید به وجود آمد. لطفاً دوباره تلاش کنید."

        return render_template("login.html", success_message=success_message, error=error_message)

    return render_template("login.html")

# صفحه اصلی ورود اطلاعات و ارسال پیامک
@app.route("/index", methods=["GET", "POST"])
def index():
    if not session.get("authenticated"):
        return redirect(url_for("login"))

    groups = GroupingTable.select()

    if request.method == "POST":
        name = request.form["name"]
        description = request.form["description"]
        group_id = request.form["group_id"]
        phone = request.form["phone"]
        no_send = request.form.get("no_send")

        if not group_id:
            error_message = "لطفاً نوع فعالیت را انتخاب کنید."
            return render_template("index.html", groups=groups, error_message=error_message)

        try:
            PhoneTable.create(
                group=group_id,
                name=name,
                phone_number=phone,
                description=description,
            )

            if not no_send:
                message = name + '\n' + request.form["message"]
                send = Send_message(phone, message)
                send.send_message()
                session['success_message'] = "اطلاعات با موفقیت ذخیره شد و پیام ارسال شد."
            else:
                session['success_message'] = "اطلاعات با موفقیت ذخیره شد. پیام ارسال نشد."

        except Exception as e:
            logging.error(f"خطا در ذخیره اطلاعات: {e}")
            session['error_message'] = "خطا در ذخیره اطلاعات."

        # 🔄 جلوگیری از ارسال مجدد با رفرش
        return redirect(url_for("index"))

    # GET method
    success_message = session.pop("success_message", None)
    error_message = session.pop("error_message", None)
    return render_template("index.html", groups=groups, success_message=success_message, error_message=error_message)


# مشاهده لیست شماره‌ها و پیگیری‌های مربوطه
@app.route('/phones')
def phone_list():
    phones = PhoneTable.select().join(GroupingTable).order_by(PhoneTable.id.desc())
    first_followups = {}
    for followup in ManagmentTable.select().order_by(ManagmentTable.id.asc()):
        if followup.id_PhT.id not in first_followups:
            first_followups[followup.id_PhT.id] = followup.description

    follow_up_types = Fallow_up_type.select()
    return render_template("phone_list.html", phones=phones, first_followups=first_followups, follow_up_types=follow_up_types)

# خروج از سیستم
@app.route("/logout")
def logout():
    session.pop("authenticated", None)
    return redirect(url_for("login"))

# ثبت پیگیری جدید (Ajax)
@app.route("/follow-up", methods=["POST"])
def follow_up():
    data = request.get_json()
    phone_id = data.get("phone_id")
    description = data.get("description")
    follow_up_type_id = data.get("follow_up_type_id")
    follow_up_date_str = data.get("follow_up_date")  # رشته تاریخ میلادی

    if not phone_id or not description or not follow_up_type_id:
        return jsonify({"message": "مقادیر ناقص هستند"}), 400

    follow_up_date = None
    if follow_up_date_str:
        try:
            follow_up_date = datetime.strptime(follow_up_date_str, "%Y-%m-%d")
        except Exception as e:
            return jsonify({"message": f"فرمت تاریخ پیگیری مجدد اشتباه است: {str(e)}"}), 400
    done = data.get('done', False)

    try:
        ManagmentTable.create(
            id_PhT=phone_id,
            description=description,
            follow_up_type=follow_up_type_id,
            follow_up_date=follow_up_date,
            done = done
        )
        return jsonify({"message": "پیگیری با موفقیت ثبت شد"})
    except Exception as e:
        return jsonify({"message": f"خطا در ذخیره‌سازی: {str(e)}"}), 500

# دریافت همه پیگیری‌های یک شماره خاص
@app.route("/follow-ups/<int:phone_id>")
def get_follow_ups(phone_id):
    followups = (
        ManagmentTable
        .select(ManagmentTable, Fallow_up_type)
        .join(Fallow_up_type)
        .where(ManagmentTable.id_PhT == phone_id)
        .order_by(ManagmentTable.created_at.asc())
    )
    data = []
    for f in followups:
        data.append({
            "id": f.id,
            "description": f.description,
            "created_at": f.created_at.isoformat(),
            "follow_up_date": f.follow_up_date.isoformat() if f.follow_up_date else None,
            "follow_up_type": f.follow_up_type.fallow_type
        })
    return jsonify(data)

# فرم دستی پیگیری
@app.route("/follow-up-form")
def follow_up_form():
    follow_up_types = Fallow_up_type.select()
    return render_template("follow_up_form.html", follow_up_types=follow_up_types)

# API برای دریافت لیست انواع پیگیری
@app.route("/api/follow-up-types", methods=["GET"])
def get_follow_up_types():
    types = Fallow_up_type.select()
    data = [{"id": t.id, "fallow_type": t.fallow_type} for t in types]
    return jsonify(data)

# API برای افزودن نوع پیگیری
@app.route("/api/follow-up-types", methods=["POST"])
def add_follow_up_type():
    data = request.get_json()
    new_type = data.get("fallow_type")
    if not new_type:
        return jsonify({"message": "نوع پیگیری وارد نشده"}), 400
    try:
        type_obj = Fallow_up_type.create(fallow_type=new_type)
        return jsonify({"id": type_obj.id, "fallow_type": type_obj.fallow_type}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# حذف نوع پیگیری با بررسی استفاده شدن یا نشدن
@app.route("/api/follow-up-types/<int:type_id>", methods=["DELETE"])
def delete_follow_up_type(type_id):
    try:
        type_obj = Fallow_up_type.get_by_id(type_id)
        type_obj.delete_instance()
        return jsonify({"message": "نوع پیگیری حذف شد"})
    except IntegrityError:
        return jsonify({"message": "امکان حذف این نوع پیگیری وجود ندارد زیرا در رکوردهای دیگر استفاده شده است."}), 400
    except Fallow_up_type.DoesNotExist:
        return jsonify({"message": "نوع پیگیری یافت نشد"}), 404

# API برای لیست پیام‌های آماده
@app.route("/api/ready-messages", methods=["GET"])
def get_ready_messages():
    messages = ReadyMessage.select()
    data = [{"id": m.id, "title": m.title, "body": m.body} for m in messages]
    return jsonify(data)

# API افزودن پیام آماده
@app.route("/api/ready-messages", methods=["POST"])
def add_ready_message():
    data = request.get_json()
    title = data.get("title")
    body = data.get("body")
    if not title or not body:
        return jsonify({"message": "موضوع و متن پیام الزامی است"}), 400
    try:
        m = ReadyMessage.create(title=title, body=body)
        return jsonify({"id": m.id, "title": m.title, "body": m.body}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# حذف پیام آماده
@app.route("/api/ready-messages/<int:msg_id>", methods=["DELETE"])
def delete_ready_message(msg_id):
    try:
        m = ReadyMessage.get_by_id(msg_id)
        m.delete_instance()
        return jsonify({"message": "پیام حذف شد"})
    except IntegrityError:
        return jsonify({"message": "امکان حذف این پیام وجود ندارد زیرا در رکوردهای دیگر استفاده شده است."}), 400
    except ReadyMessage.DoesNotExist:
        return jsonify({"message": "پیام یافت نشد"}), 404

# API برای دریافت گروه‌ها
@app.route('/api/groups', methods=['GET'])
def get_groups():
    groups = GroupingTable.select()
    return jsonify([{'id': g.id, 'group': g.group} for g in groups])

# API برای افزودن گروه جدید
@app.route('/api/groups', methods=['POST'])
def add_group():
    data = request.get_json()
    group_name = data.get('group', '').strip()
    if not group_name:
        return jsonify({'message': 'نام گروه الزامی است'}), 400
    group = GroupingTable.create(group=group_name)
    return jsonify({'id': group.id, 'group': group.group})

# API برای حذف گروه
@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    try:
        group = GroupingTable.get_by_id(group_id)
        group.delete_instance()
        return jsonify({'message': 'گروه حذف شد'})
    except IntegrityError:
        return jsonify({'message': 'امکان حذف این گروه وجود ندارد زیرا در رکوردهای دیگر استفاده شده است.'}), 400
    except GroupingTable.DoesNotExist:
        return jsonify({'message': 'گروه یافت نشد'}), 404



# اجرای اپلیکیشن
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
