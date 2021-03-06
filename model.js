import mongoose from 'mongoose';
import crypto from 'crypto';

export const User = mongoose.model('User', {
	name: {
		type: String,
		unique: true
	},

	password: {
		type: String,
		required: true
	},
	accessToken: {
		type: String,
		default: () => crypto.randomBytes(128).toString('hex')
	},
	favoriteGames: {
		type: Array,
		default: []
	}
});

export const Message = mongoose.model('Message', {
	message: {
		type: String,
		required: true
	},
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	likes: {
		type: Number,
		default: 0
	},
	game: {
		type: String,
		default: 'general'
	},
	createdAt: {
		type: Date,
		default: Date.now
	}
});
export const Game = mongoose.model('Game', {
	slug: String,
	name: String,
	released: String,
	backgroundImage: String,
	rating: Number,
	screenshots: {
		type: Array,
		default: []
	},
	genres: {
		type: Array,
		default: []
	}
});

export const Genre = mongoose.model('Genre', {
  slug: String,
  name: String,
  backgroundImage: String,
  gamesCount: Number,
  description: String
})