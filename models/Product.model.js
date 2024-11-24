const mongoose = require('mongoose');

// 랜덤 숫자 배열 생성 함수
function generateRandomNumberArray(length, min = 0, max = 9) {
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        result += randomNum;
    }
    return result;
}

// 배송 상태 상수 정의
const DELIVERY_STATUS = {
    ORDER_CONFIRMED: '주문 확인'
};

const ProductSchema = mongoose.Schema(
    {
        id: {
            type: String,
            default: () => generateRandomNumberArray(12),
            required: true,
            unique: true
        },

        username: {
            type: String,
            required: [true, "Please enter your name"]
        },

        useremail: {
            type: String,
            required: [true, "Please enter an email"],
            match: [/\S+@\S+\.\S+/, 'Please enter a valid email address']
        },

        deliveryDate: {
            type: Date,
            required: [true, "Please enter a delivery date"]
        },

        address: {
            type: String,
            required: [true, "Please enter an address"]
        },

        product: {
            type: Object,
            required: true,
            default: null
        },

        deliveryStatus: {
            type: String,
            enum: Object.values(DELIVERY_STATUS), // 허용된 상태값만 입력 가능
            default: DELIVERY_STATUS.ORDER_CONFIRMED, // 기본값은 '주문 확인'
            required: true
        },

        applicationDate: {
            type: Date,
            default: Date.now,
            required: false
        }
    },
    {
        timestamps: true
    }
);

// 상태값 상수 추가
ProductSchema.statics.DELIVERY_STATUS = DELIVERY_STATUS;

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
