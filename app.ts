import express, {Request, Response} from 'express';
import { config } from 'dotenv';
import handleContact from './HandleContact';
import deleteAllRows from './DeleteRows';

config();
const app = express();

app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
    const response = await handleContact(req.body.phoneNumber, req.body.email);
    res.send(response);
});

app.listen(process.env.PORT, async () => {
    await deleteAllRows(); // clears the table on each run
    console.log(`Listening on port: ${process.env.PORT}`);
});