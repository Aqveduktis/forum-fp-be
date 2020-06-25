import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt-nodejs';
import fetch from 'node-fetch';

require('express-async-errors');
import { User, Message, Game, Genre } from './model';

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
	const seedGames = async () => {
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
	const seedGenres = async () => {
		const genresList = [
			'action',
			'adventure',
			'fighting',
			'indie',
			'platformer',
			'puzzle',
			'racing',
			'role-playing-games-rpg',
			'shooter'
		];
		let result = null;
		let json = null;
		try {
			await Genre.deleteMany();
			for (const genre of genresList) {
				result = await fetch(`https://api.rawg.io/api/genres/${genre}`);
				json = await result.json();
				if (json.name) {
					new Genre({
						slug: json.slug,
						name: json.name,
						backgroundImage: json.image_background,
						gamesCount: json.games_count,
						description: json.description
					}).save();
				} else {
					throw 'fetch did not work';
				}
			}
		} catch (err) {
			console.log(err);
		}
	};
	seedGames();
	seedGenres();
}
// authenicate user
const authenticateUser = async (req, res, next) => {
	try {
		const user = await User.findOne({
			accessToken: req.header('Authorization')
		});
		if (user) {
			req.user = user;
			next();
		} else {
			res.status(401).json({ loggedOut: true });
		}
	} catch (err) {
		res.status(403).json({ errors: err.errors });
	}
};

app.use((req, res, next) => {
	if (mongoose.connection.readyState === 1) {
		next();
	} else {
		res.status(503).json({ error: 'service unavailible' });
	}
});
const notFound = 'requested entry not found';
const badRequest = 'could not complete request';

//Start defining your routes here
//routes: users, session(log in), messages, games
app.get('/', (req, res) => {
	res.status(200).send('Hello world');
});
//*************************************************************** */
//find all users
app.get('/users', async (req, res) => {
	try {
		const users = await User.find({}, 'name');
		if (users.length) {
			res.status(200).json(users);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// creating new user
app.post('/users', async (req, res) => {
	try {
		const { name, password } = req.body;
		if (password) {
			const user = new User({ name, password: bcrypt.hashSync(password) });
			const saved = await user.save();
			res.status(201).json(saved);
		} else {
			throw badRequest;
		}
	} catch (err) {
		res.status(400).json({ errors: err });
	}
});
// get one user
app.get('/users/:id', authenticateUser);
app.get('/users/:id', async (req, res) => {
	try {
		const messages = await Message.find({ user: mongoose.Types.ObjectId(req.user.id) });
		res.status(200).json({ name: req.user.name, favoriteGames: req.user.favoriteGames, messages });
	} catch (err) {
		res.status(400).json({ errors: err });
	}
});

//
app.put('/users/:id/:slug', authenticateUser);
app.put('/users/:id/:slug', async (req, res) => {
	const { id, slug } = req.params;
	try {
		const user = await User.findById(id);
		const games = user.favoriteGames;
		let userUpdate = null;
		if (games.includes(slug)) {
			userUpdate = await User.findByIdAndUpdate(
				{ _id: id },
				{ $pull: { favoriteGames: slug } },
				{ new: true }
			).exec();
		} else {
			userUpdate = await User.findByIdAndUpdate({ _id: id }, { $push: { favoriteGames: slug } }, { new: true });
		}

		if (userUpdate) {
			res.status(201).json(userUpdate);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// delete one user
app.delete('/users/:id', authenticateUser);
app.delete('/users/:id', async (req, res) => {
	const { id } = req.params;
	try {
		await Message.deleteMany({ user: id });
		await User.findOneAndDelete({ _id: id });
		res.json({ message: `user with id:${id} was delted` });
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// get all messages from one user

//*************************************************************** */
// logged in
app.post('/sessions', async (req, res) => {
	const user = await User.findOne({ name: req.body.name });

	if (user && bcrypt.compareSync(req.body.password, user.password)) {
		res.status(200).json({ userId: user._id, accessToken: user.accessToken });
	} else {
		res.status(401).json({ notFound: true });
	}
});

//*************************************************************** */
// show messages
app.get('/messages', async (req, res) => {
	try {
		const messages = await Message.find().populate('user', 'name').sort({ createdAt: 'desc' }).limit(20);
		if (messages.length) {
			res.status(200).json(messages);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// post a new message
app.post('/messages', authenticateUser);
app.post('/messages', async (req, res) => {
	try {
		const { message, game } = req.body;
		const user = await User.findById(req.user._id).exec();
		const newMessage = await new Message({ message, game, user }).save();
		await newMessage.populate('user', 'name');
		res.status(201).json(newMessage);
	} catch (err) {
		res.status(400).json({ error: err });
	}
});
// delete message with an Id
app.post('/messages/:id/like', async (req, res) => {
	const { id } = req.params;
	try {
		const message = await Message.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true }).populate(
			'user',
			'name'
		);
		if (message) {
			res.status(201).json(message);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.delete('/messages/:id', authenticateUser);
app.delete('/messages/:id', async (req, res) => {
	try {
		const { id } = req.params;
		await Message.findOneAndDelete({ _id: id });
		res.status(200).json({ message: `message with id:${id} was delted` });
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

//*************************************************************** */
// all games
app.get('/games', async (req, res) => {
	try {
		const myGames = await Game.find();
		if (myGames.length) {
			res.status(200).json(myGames);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});
// one game
app.get('/games/:slug', async (req, res) => {
	try {
		const { slug } = req.params;
		const myGame = await Game.findOne({ slug });
		if (myGame) {
			res.status(200).json(myGame);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.get('/genres', async (req, res) => {
	try {
		const myGenres = await Genre.find();
		if (myGenres.length) {
			res.status(200).json(myGenres);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.get('/genres/:slug', async (req, res) => {
	try {
		const { slug } = req.params;
		const genre = await Genre.findOne({ slug });

		if (genre) {
			res.status(200).json(genre);
		} else {
			res.status(404).json({ error: notFound });
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// Start the server
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
