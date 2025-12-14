import express from 'express';
import 'dotenv/config';

const port = process.env.PORT;

const app = express();
app.use(express.json());

const init = () => {
    if (!port) throw new Error("Could not start express application. Please specify a port within the environment variables.")
    app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
};

init();
