const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { Setting, Project, Evaluator, Panel, Result, EvaluatorState } = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Debug Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sce-carnival';
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        // Migration: Drop unique index on code if it exists to allow duplicate codes
        try {
            await Evaluator.collection.dropIndex('code_1');
            console.log('Dropped unique index on code');
        } catch (e) {
            // Index might not exist, ignore
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// --- Auth Routes ---

app.post('/api/auth/admin-login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const settings = await Setting.findOne();
        const dbEmail = settings?.adminEmail || 'admin@example.com';
        const dbPass = settings?.adminPass || 'admin123';
        if (email === dbEmail && password === dbPass) {
            const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ ok: true, token });
        }
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/eval-login', async (req, res) => {
    const { email, code } = req.body;
    try {
        const evaluator = await Evaluator.findOne({ email, code });
        if (evaluator) {
            const token = jwt.sign({ role: 'evaluator', id: evaluator.id }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ ok: true, token, evaluator });
        }
        res.status(401).json({ ok: false, error: 'Invalid email or access code' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Middleware ---

const isAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') return next();
        throw new Error('Not admin');
    } catch (e) {
        res.status(403).json({ error: 'Unauthorized' });
    }
};

const isEvaluator = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'evaluator') {
            req.evaluatorId = decoded.id;
            return next();
        }
        throw new Error('Not evaluator');
    } catch (e) {
        res.status(403).json({ error: 'Unauthorized' });
    }
};

// --- Data Routes ---

app.get('/api/data', async (req, res) => {
    try {
        const [settings, evaluators, projects, panels, results, evalStates] = await Promise.all([
            Setting.findOne(),
            Evaluator.find(),
            Project.find(),
            Panel.find(),
            Result.find(),
            EvaluatorState.find()
        ]);

        const evaluatorState = {};
        evalStates.forEach(s => {
            evaluatorState[s.evaluatorId] = { finalizedAll: s.finalizedAll };
        });

        res.json({
            settings: settings || {},
            evaluators,
            projects,
            panels,
            results,
            evaluatorState
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Settings Routes ---

app.put('/api/settings', isAdmin, async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, req.body, { upsert: true, new: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Projects Routes ---

app.post('/api/projects', isAdmin, async (req, res) => {
    try {
        // Assume req.body contains the full project object including generated ID
        await Project.create(req.body);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/projects/:id', isAdmin, async (req, res) => {
    try {
        await Project.findOneAndUpdate({ id: req.params.id }, req.body, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', isAdmin, async (req, res) => {
    try {
        await Project.findOneAndDelete({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Evaluators Routes ---

app.post('/api/evaluators', isAdmin, async (req, res) => {
    try {
        await Evaluator.create(req.body);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/evaluators/:id', isAdmin, async (req, res) => {
    try {
        await Evaluator.findOneAndUpdate({ id: req.params.id }, req.body, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/evaluators/:id', isAdmin, async (req, res) => {
    try {
        await Evaluator.findOneAndDelete({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Panels Routes ---

app.post('/api/panels', isAdmin, async (req, res) => {
    try {
        await Panel.create(req.body);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/panels/:id', isAdmin, async (req, res) => {
    try {
        await Panel.findOneAndUpdate({ id: req.params.id }, req.body, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/panels/:id', isAdmin, async (req, res) => {
    try {
        await Panel.findOneAndDelete({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Bulk Routes ---

app.post('/api/projects/bulk', isAdmin, async (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Request body must be an array' });
        }

        if (req.body.length === 0) {
            return res.json({ ok: true });
        }

        const ops = req.body.map(p => ({
            updateOne: {
                filter: { id: p.id },
                update: { $set: p },
                upsert: true
            }
        }));

        // ordered: false ensures that if one fails (e.g. other unique constraint), the rest continue
        await Project.bulkWrite(ops, { ordered: false });
        res.json({ ok: true });
    } catch (err) {
        // If it's a BulkWriteError (partial failure), we still consider it a "success" in terms of HTTP response
        // but log it. The client might want to know, but for now we ensure valid records are saved.
        if (err && err.name === 'BulkWriteError') {
            console.warn('Bulk project import partial errors:', err.message);
            return res.json({ ok: true, warning: 'Some records failed to import (likely validation/duplicates)' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/evaluators/bulk', isAdmin, async (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Request body must be an array' });
        }

        if (req.body.length === 0) {
            return res.json({ ok: true });
        }

        const ops = req.body.map(e => ({
            updateOne: {
                filter: { id: e.id },
                update: { $set: e },
                upsert: true
            }
        }));

        await Evaluator.bulkWrite(ops, { ordered: false });
        res.json({ ok: true });
    } catch (err) {
        if (err && err.name === 'BulkWriteError') {
            console.warn('Bulk evaluator import partial errors:', err.message);
            return res.json({ ok: true, warning: 'Some records failed to import (likely validation/duplicates)' });
        }
        res.status(500).json({ error: err.message });
    }
});

// --- Results Routes ---

// Evaluator saving a result (draft or final)
app.post('/api/results', isEvaluator, async (req, res) => {
    try {
        const { id, evaluatorId, panelId, projectId, scores, remark, total, finalizedByEvaluator } = req.body;

        // Security check
        if (evaluatorId !== req.evaluatorId) {
            return res.status(403).json({ error: 'Cannot save for another evaluator' });
        }

        // Allow upsert based on ID
        await Result.findOneAndUpdate(
            { id: id },
            req.body,
            { upsert: true, new: true }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/evaluator/finalize', isEvaluator, async (req, res) => {
    const { evaluatorId } = req.body;
    try {
        if (evaluatorId !== req.evaluatorId) return res.status(403).json({ error: 'Unauthorized' });

        await EvaluatorState.findOneAndUpdate(
            { evaluatorId },
            { finalizedAll: true },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/evaluator/profile', isEvaluator, async (req, res) => {
    const { evaluator } = req.body;
    try {
        if (evaluator.id !== req.evaluatorId) return res.status(403).json({ error: 'Unauthorized' });
        await Evaluator.findOneAndUpdate({ id: evaluator.id }, evaluator, { upsert: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin clearing results
app.delete('/api/results', isAdmin, async (req, res) => {
    try {
        await Result.deleteMany({});
        await EvaluatorState.deleteMany({});
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin reset all data
app.post('/api/admin/reset', isAdmin, async (req, res) => {
    try {
        await Evaluator.deleteMany({});
        await Project.deleteMany({});
        await Panel.deleteMany({});
        await Result.deleteMany({});
        await EvaluatorState.deleteMany({});
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Global Error Handlers ---

// 404 Handler
app.use((req, res) => {
    console.log(`404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ ok: false, error: 'API Endpoint Not Found' });
});

// 500 Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
