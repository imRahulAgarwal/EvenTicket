import "dotenv/config";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import MongoStore from "connect-mongo";
import nunjucks from "nunjucks";
import flash from "connect-flash";
import connectDatabase from "./configs/connectDatabase.js";
import panelRouter from "./routes/panelRoutes.js";
import clientRouter from "./routes/clientRoutes.js";
import initializeData from "./utils/init.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import path from "path";

const app = express();

const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ENVIRONMENT = process.env.ENVIRONMENT;
const MONGO_URL = process.env.MONGO_URL;

// This code has to be written because
// Express 5 changed the default query parsing behavior compared to previous versions.
// In Express 4 you might have seen nested query parameters parsed as objects, while in Express 5 the default parser treats them as flat keys.
// Consequently, you now receive keys such as 'search[value]' instead of an object for search.
app.set("query parser", "extended");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "html");
app.use(express.static("./public"));
app.use("/uploads", express.static(path.join(path.resolve(), "uploads")));

nunjucks.configure("./views", {
    autoescape: true,
    express: app,
    watch: false,
});

app.locals.doesRoleIncludesPermission = function (permissions, permissionUniqueName) {
    return permissions.find((permission) => permission.uniqueName === permissionUniqueName);
};

app.use(cookieParser());

const newSession = session({
    secret: SESSION_SECRET,
    cookie: {
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
        secure: ENVIRONMENT === "PRODUCTION" ? true : false,
        sameSite: "lax",
    },
    saveUninitialized: false,
    resave: false,
    rolling: true,
    store: new MongoStore({ mongoUrl: MONGO_URL }),
});

app.use(newSession);
app.use(flash());

await connectDatabase().then(() => initializeData());

app.use("/panel", panelRouter);
app.use("/client", clientRouter);
app.use(errorMiddleware);

app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
