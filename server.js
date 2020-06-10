import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt-nodejs';
import fetch from 'node-fetch';

require('express-async-errors');
import { User, Message, Game } from './model';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/forum';
mongoose.connect(mongoUrl, { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true });
//mongoose.set('useCreateIndex', true);
mongoose.Promise = Promise;

// Defines the port the app will run on. Defaults to 8080, but can be
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(bodyParser.json());

if (process.env.RESET_DB) {
	const seedDatabase = async () => {
		try {
			await Game.deleteMany();
			const myUrl = 'https://api.rawg.io/api/games?ordering=-rating0';
			const result = await fetch(myUrl);
			const json = await result.json();
			const oldGames = json.results;

			if (oldGames.length) {
				oldGames.forEach((game) => {
					new Game({
						name: game.name,
						slug: game.slug,
						released: game.released,
						backgroundImage: game.background_image,
						rating: game.rating,
						genres: game.genres,
						screenshots: game.short_screenshots
					}).save();
				});
			} else {
				throw 'array is empty';
			}
		} catch (err) {
			console.log(err);
		}
	};
	seedDatabase();
}

const authenticateUser = async (req, res, next) => {
	try {
		const user = await User.findOne({
			accessToken: req.header('Authorization')
		});
		console.log(req.header('Authorization'));
		if (user) {
			req.user = user;
			next();
		} else {
			res.status(401).json({ loggedOut: true, message: 'Please try logging in again' });
		}
	} catch (err) {
		res.status(403).json({ message: 'access token missing or wrong', errors: err.errors });
	}
};
//Start defining your routes here
app.use((req, res, next) => {
	if (mongoose.connection.readyState === 1) {
		next();
	} else {
		res.status(503).json({ error: 'service unavailible' });
	}
});

app.get('/', (req, res) => {
	res.send('Hello world');
});
app.get('/users', async (req, res) => {
	const users = await User.find();
	res.json(users);
});

app.post('/users', async (req, res) => {
	try {
		const { name, password } = req.body;
		if (password) {
			const user = new User({ name, password: bcrypt.hashSync(password) });
			const saved = await user.save();
			res.status(201).json(saved);
		} else {
			throw 'you have to have a password';
		}
	} catch (err) {
		res.status(400).json({ message: 'Could not save user 1', errors: err });
	}
});

app.get('/users/:id', authenticateUser);
app.get('/users/:id', (req, res) => {
	try {
		res.status(201).json({ name: req.user.name });
	} catch (err) {
		res.status(400).json({ message: 'could not save user 2', errors: err.errors });
	}
});
app.delete('/users/:id', async (req, res) => {
	const { id } = req.params;
	try {
		await User.findOneAndDelete({ _id: id });
		res.json({ message: `thought with id:${id} was delted` });
	} catch (err) {
		res.status(400).json({ message: 'thought could not be deleted', error: err });
	}
});

app.get('/users/:id/messages', authenticateUser);
app.get('/users/:id/messages', async (req, res) => {
	try {
		const user = await User.findById(req.user._id).exec();
		const messages = await Message.find({ user: mongoose.Types.ObjectId(user.id) });
		if (messages.length) {
			res.status(200).json(messages);
		} else {
			throw 'Sorry no messages';
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});
app.post('/users/:id/messages', authenticateUser);
app.post('/users/:id/messages', async (req, res) => {
	try {
		const { message, game } = req.body;
		const user = await User.findById(req.user._id).exec();
		const newMessage = await new Message({ message, game, user }).save();
		res.status(201).json({ message: newMessage.message, user: newMessage.user.name });
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.post('/sessions', async (req, res) => {
	const user = await User.findOne({ name: req.body.name });

	if (user && bcrypt.compareSync(req.body.password, user.password)) {
		res.json({ userId: user._id, accessToken: user.accessToken });
	} else {
		res.json({ notFound: true });
	}
});
app.get('/messages', async (req, res) => {
	try {
		const messages = await Message.find().populate('user', 'name');
		if (messages.length) {
			res.status(200).json(messages);
		} else {
			throw 'you have no messages';
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.get('/games', async (req, res) => {
	try {
		const myGames = await Game.find();
		if (myGames.length) {
			res.status(200).json(myGames);
		} else {
			throw 'length is zero';
		}
		//const github = await oIfoundData()const ooiResponseData = await github.json()console.log(ooiResponseData)
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.get('/games/:slug', async (req, res) => {
	try {
		const { slug } = req.params;
		const myGame = await Game.findOne({ slug });
		res.status(200).json(myGame);

		//const github = await oIfoundData()const ooiResponseData = await github.json()console.log(ooiResponseData)
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// Start the server
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
