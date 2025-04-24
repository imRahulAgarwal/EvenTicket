import multer from "multer";

const fileUploader = (fileTypes, errorMessage) => {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (req, file, cb) => {
            const extname = fileTypes.test(file.mimetype);
            if (extname) {
                return cb(null, true);
            } else {
                cb(new Error(errorMessage));
            }
        },
    });
};

const imageRegex = /jpeg|jpg|png/;
export const imageUpload = fileUploader(imageRegex, "JPG and PNG files are allowed!");
