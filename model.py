import re
from datetime import datetime

import jdatetime
from peewee import Model, CharField, IntegerField, ForeignKeyField, SQL, TextField, AutoField, DateTimeField, \
    BooleanField
from playhouse.db_url import connect
from config import DB_USER, DB_PASS, DB_PORT, DB_DATABASE

database = connect(f'mysql://{DB_USER}:{DB_PASS}@127.0.0.1:{DB_PORT}/{DB_DATABASE}?charset=utf8mb4')

# مدل پایه برای همه جداول
class BaseModel(Model):
    class Meta:
        database = database
    def __str__(self):
        return str(self.id)

# جدول گروه‌ها
class GroupingTable(BaseModel):
    id = AutoField()
    group = CharField(max_length=45, null=True)

# جدول شماره تماس‌ها
class PhoneTable(BaseModel):
    id = AutoField()
    created_date = DateTimeField(default=datetime.now)
    group = ForeignKeyField(GroupingTable, backref='phones', on_delete='RESTRICT')  # foreign key to groups
    name = CharField(max_length=255, null=True)
    phone_number = CharField(max_length=15)  # استفاده از string به‌جای int
    description = CharField(max_length=255, null=True)

    @property
    def jalali_created_date(self):
        if self.created_date:
            # تبدیل تاریخ میلادی به شمسی
            dt = self.created_date
            jd = jdatetime.datetime.fromgregorian(datetime=dt)
            return jd.strftime('%Y/%m/%d %H:%M')
        return ''
class Fallow_up_type(BaseModel):
    id = AutoField()
    fallow_type = CharField(max_length=45, null=True)

class ManagmentTable(BaseModel):
    id = AutoField()
    id_PhT = ForeignKeyField(PhoneTable, backref='managers', on_delete='RESTRICT')
    created_at = DateTimeField(default=datetime.now)
    description = CharField(max_length=255, null=True)
    follow_up_type =ForeignKeyField(Fallow_up_type, on_delete='RESTRICT')
    follow_up_date = DateTimeField(null=True)
    done = IntegerField(default=False)

class ReadyMessage(BaseModel):
    id = AutoField()
    title = CharField(max_length=100, null=False)  # موضوع پیام
    body = TextField(null=False)                   # متن پیام


with database:
    database.execute_sql("SET NAMES utf8mb4;")
    database.create_tables([GroupingTable, PhoneTable, ManagmentTable, Fallow_up_type, ReadyMessage])

__all__ = ['database', 'GroupingTable', 'PhoneTable', 'ManagmentTable', 'Fallow_up_type', 'ReadyMessage']


def validate_phone(value):
    pattern = r"^(?:\+98|0098|98|0)?(9\d{9})$"
    match = re.match(pattern, value)

    if match:
        # گرفتن شماره اصلی (10 رقمی که با 9 شروع می‌شود)
        main_number = match.group(1)
        # افزودن پیشوند 0 به شماره
        return f"0{main_number}"
    else:
        # شماره نامعتبر است
        return False
