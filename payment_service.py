import os
from flask import Flask, request, jsonify
import requests
from dotenv import load_dotenv

# លុបចោលនូវ imports ដែលមិនប្រើ
# import qrcode
# import io
# import base64
# from bakong_khqr import BakongKHQR
import hmac
import hashlib

# ផ្ទុក environment variables ពីไฟล์ .env
load_dotenv()

app = Flask(__name__)

# --- ព័ត៌មានសម្ងាត់របស់ Bakong ---
BAKONG_WEBHOOK_SECRET = os.getenv("BAKONG_WEBHOOK_SECRET")
# BAKONG_MERCHANT_ID = os.getenv("BAKONG_MERCHANT_ID", "YOUR_MERCHANT_ID")
# BAKONG_MERCHANT_NAME = os.getenv("BAKONG_MERCHANT_NAME", "My Awesome Shop")
# --------------------------------

# ទាញយក BOT_TOKEN ពី environment variable
BOT_TOKEN = os.getenv('BOT_TOKEN')
# URL របស់ Node.js bot របស់អ្នក (សម្រាប់ callback)
# នឹងទាញយកពី Environment Variable នៅលើ Render, បើមិនមាននឹងប្រើ Localhost សម្រាប់ Development
BOT_WEBHOOK_URL = os.getenv('BOT_WEBHOOK_URL', 'http://127.0.0.1:3003/payment-complete')

# ជាទូទៅ ព័ត៌មាន order គួរតែរក្សាទុកក្នុង Database
# ក្នុងឧទាហរណ៍នេះ យើងប្រើ Dictionary បណ្ដោះអាសន្ន
pending_orders = {}

# Endpoint '/create-bakong-payment' មិនត្រូវបានប្រើប្រាស់ទៀតទេ ពេលប្រើ Static QR

@app.route('/bakong-webhook', methods=['POST'])
def bakong_webhook():
    """
    Endpoint សម្រាប់ទទួលការជូនដំណឹង (Webhook) ពីប្រព័ន្ធរបស់ Bakong
    """
    # ជំហានទី១៖ ទទួលបាន Signature ពី Header និង Raw Body ពី Request
    # ចំណាំ៖ ឈ្មោះ Header អាចខុសពីនេះ សូមពិនិត្យមើលឯកសារផ្លូវការរបស់បាគង
    signature_from_header = request.headers.get('X-Bakong-Signature')
    raw_body = request.get_data() # ត្រូវតែយក Raw Body សម្រាប់ Hashing

    if not signature_from_header:
        print("Webhook Error: Missing signature header.")
        return jsonify({'error': 'Missing signature'}), 403

    if not BAKONG_WEBHOOK_SECRET:
        print("Configuration Error: BAKONG_WEBHOOK_SECRET is not set.")
        return jsonify({'error': 'Server configuration error'}), 500

    # ជំហានទី២៖ បង្កើត Signature ដោយខ្លួនឯង
    # យើងប្រើក្បួនដោះស្រាយ HMAC-SHA256 (នេះជាឧទាហរណ៍ សូមប្រាកដថាប្រើក្បួនដែលបាគងកំណត់)
    computed_hash = hmac.new(BAKONG_WEBHOOK_SECRET.encode('utf-8'), raw_body, hashlib.sha256)
    computed_signature = computed_hash.hexdigest()

    # ជំហានទី៣៖ ប្រៀបធៀប Signature ទាំងពីរដោយសុវត្ថិភាព
    if not hmac.compare_digest(computed_signature, signature_from_header):
        print("Webhook Error: Invalid signature.")
        return jsonify({'error': 'Invalid signature'}), 403

    # --- Signature is valid, we can now trust the data ---
    print("Webhook signature is valid. Processing payment...")
    webhook_data = request.get_json()

    # --- ចំណុចសំខាន់ដែលបានផ្លាស់ប្តូរ ---
    # ស្រង់យក "លេខយោង" ពី Webhook payload។ ឈ្មោះ field អាចជា 'remark', 'description', 'memo' ។ល។
    # សូមពិនិត្យមើលទិន្នន័យ Webhook ពិតប្រាកដដែលអ្នកទទួលបានពីធនាគាររបស់អ្នក។
    ref_code = webhook_data.get('remark') 
    payment_status = webhook_data.get('status')
    # អ្នកក៏គួរតែពិនិត្យមើលចំនួនទឹកប្រាក់ដែលបានទូទាត់ផងដែរ (webhook_data.get('amount'))

    # ក្នុង Node.js bot យើងបានរក្សាទុក pending order នៅក្នុង Database រួចហើយ
    # ដូច្នេះ Python service នេះមិនចាំបាច់ដឹងព័ត៌មាន order ជាមុនទេ
    # វាគ្រាន់តែបញ្ជូន ref_code ដែលទទួលបាន ត្រឡប់ទៅឱ្យ Node.js bot វិញ

    if payment_status == 'SUCCESS' and ref_code:
        
        # ផ្ញើការបញ្ជាក់ត្រឡប់ទៅកាន់ Node.js bot វិញ
        try:
            callback_payload = {
                'refCode': ref_code, # បញ្ជូន ref_code ត្រឡប់ទៅវិញ
                'status': 'completed',
                # អ្នកអាចបញ្ជូនព័ត៌មានបន្ថែមពី webhook មកជាមួយបាន បើចាំបាច់
                # 'amountPaid': webhook_data.get('amount'),
                # 'transactionId': webhook_data.get('transactionId')
            }
            response = requests.post(BOT_WEBHOOK_URL, json=callback_payload)
            response.raise_for_status() # ពិនិត្យមើលថា request ជោគជ័យឬអត់
            print(f"Successfully sent callback to Node.js bot for refCode: {ref_code}")

        except requests.exceptions.RequestException as e:
            print(f"Error calling back to Node.js bot: {e}")
            # ត្រូវមានយន្តការ retry នៅទីនេះ

    return jsonify({'status': 'received'}), 200

if __name__ == '__main__':
    # ដំណើរការ Flask server នៅ Port 5000
    app.run(port=5000, debug=True)
