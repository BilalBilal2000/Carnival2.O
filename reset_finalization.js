const mongoose = require('mongoose');
const { EvaluatorState } = require('./models');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sce-carnival';

async function resetAllFinalizations() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await EvaluatorState.updateMany({}, { finalizedAll: false });
        console.log(`Successfully reset finalization for ${result.modifiedCount} evaluators.`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error resetting finalization:', err);
        process.exit(1);
    }
}

resetAllFinalizations();
