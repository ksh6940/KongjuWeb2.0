const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const { GridFSBucket } = require('mongodb');
const fs = require('fs');

// model 불러오기
const Product = require("./models/Product.model.js");

// Express App 설정
const app = express();
const port = 5000;

// GridFS 버킷 설정
let gridfsBucket;
mongoose.connection.once('open', () => {
  gridfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Multer 설정 (메모리에 임시 저장)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 전역변수
let FileData;
let JsonData;
let finallyjson;

// Express 미들웨어 설정
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname + "/templates")));
app.use(express.json());

// GET : 메인 페이지 렌더링
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/templates/html/main.html"));
});

// 동적 페이지 라우팅
app.get("/:id", (req, res) => {
  let getID = req.params.id;
  let File = `/templates/html/${getID}.html`;
  res.sendFile(path.join(__dirname + File));
});

// 사용자 정보 양식 요청
app.get("/api/writeform/user", (req, res) => {
  res.sendFile(path.join(__dirname + "/templates/html/Ask/InfoForm.html"));
});

// 신청 양식 요청
app.get("/api/writeform/ask", (req, res) => {
  res.sendFile(path.join(__dirname, "/templates/html/Ask/AskForm.html"));
});

// 결과 양식 요청
app.get("/api/writeform/result", (req, res) => {
  res.sendFile(path.join(__dirname, "/templates/html/Ask/OrderInfo.html"));
});

// 파일 업로드 여부 및 데이터 전송 처리
app.post("/api/writeform/ask", (req, res) => {
  FileData = req.body;
  console.log("Received JSON data: ", FileData);

  res.json({
    message: "Data received successfully",
    nextPage: "/api/writeform/ask",
  });
});

// 파일 업로드 처리 - GridFS 사용
app.post("/api/writeform/user", upload.single("file"), async (req, res) => {
  const { fileName, count, color, detail } = req.body;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
  }

  try {
    // GridFS에 파일 저장
    const uploadStream = gridfsBucket.openUploadStream(file.originalname, {
      contentType: file.mimetype
    });

    // 파일의 버퍼를 직접 GridFS에 업로드
    uploadStream.end(file.buffer);

    // 업로드가 완료된 후 JSON 데이터 생성
    JsonData = {
      fileId: uploadStream.id, // GridFS 파일 ID 저장
      fileName: fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      count: count,
      color: color,
      detail: detail,
      blueprint: FileData,
    };

    res.json({
      message: "Data received successfully",
      nextPage: "/api/writeform/user",
      fileId: uploadStream.id.toString()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// 최종 주문 정보 처리
app.post("/api/writeform/result", async (req, res) => {
  const { name, email, deliveryDate, address } = req.body;

  finallyjson = {
    username: name,
    useremail: email,
    deliveryDate: deliveryDate,
    address: address,
    product: JsonData,
  }

  try {
    const productEntry = await Product.create(finallyjson);
    res.status(200).json({
      message: "Data received and saved successfully",
      product: productEntry,
      nextPage: "/api/writeform/result",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// JSON 데이터 조회
app.post("/api/getjson", (req, res) => {
  res.json(finallyjson);
});

// 파일 다운로드 엔드포인트
app.get("/api/download/:fileId", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    
    // GridFS에서 파일 찾기
    const files = await gridfsBucket.find({ _id: fileId }).toArray();
    
    if (!files.length) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = files[0];

    // 다운로드를 위한 헤더 설정
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`);

    // 파일 스트리밍
    const downloadStream = gridfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// READ API (모든 제품 조회)
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({});
    // 각 제품에 대해 파일 다운로드 URL 추가
    const productsWithDownloadUrls = products.map(product => {
      const fileId = product.product?.fileId;
      if (fileId) {
        return {
          ...product.toObject(),
          product: {
            ...product.product,
            downloadUrl: `/api/download/${fileId}`
          }
        };
      }
      return product;
    });
    res.status(200).json(productsWithDownloadUrls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 특정 제품 검색 API
app.get("/api/search/:keyword", async (req, res) => {
  try {
    const { keyword } = req.params;
    const product = await Product.findById(keyword);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 파일 다운로드 URL 추가
    const fileId = product.product?.fileId;
    if (fileId) {
      product.product.downloadUrl = `/api/download/${fileId}`;
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MongoDB 연결 및 서버 실행
mongoose
  .connect(
    // MongoDB Key
  )
  .then(() => {
    console.log("MongoDB 연결 성공");
    app.listen(port, () => {
      console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
    });
  })
  .catch((err) => {
    console.error("MongoDB 연결 실패:", err.message);
  });