import requests
from config import PHONE_MELIPAYAMAK, Melipayamak_API

class Send_message:
    def __init__(self, phone_number, message):
        self.phone_number = phone_number
        self.message = message
    def send_message(self):
        data = {'from': PHONE_MELIPAYAMAK, 'to': self.phone_number, 'text': f' {self.message} \n لغو11 '  }
        response = requests.post(url=Melipayamak_API,
                                 json=data)
        print(response.json())