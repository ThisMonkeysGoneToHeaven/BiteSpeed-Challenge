import express, {Request, Response} from 'express';
import handleContact from './HandleContact';
import deleteAllRows from './DeleteRows';

const app = express();
const $PORT = 3000;

app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
    const response = await handleContact(req.body.phoneNumber, req.body.email);
    res.send(response);
});

app.listen($PORT, async () => {
    await deleteAllRows(); // clears the table on each run
    console.log(`Listening on port: ${$PORT}`);
});