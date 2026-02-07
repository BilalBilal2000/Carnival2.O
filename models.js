const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    eventTitle: { type: String, default: 'Science Carnival 2025' },
    subtitle: { type: String, default: 'Project Evaluation System' },
    welcomeTitle: { type: String, default: 'Welcome to Science Carnival 2025' },
    welcomeBody: { type: String, default: 'Please select your role to continue.' },
    logoUrl: { type: String, default: 'https://dummyimage.com/128x128/1f2a52/ffffff&text=SE' },
    adminPass: { type: String, default: 'admin123' },
    adminEmail: { type: String, default: 'admin@example.com' },
    rubric: {
        type: [{
            key: String,
            label: String,
            description: String,
            maxPoints: { type: Number, default: 10 }
        }],
        default: [
            { key: 'problem', label: 'Introduction/Clarity', description: 'Imagination in thinking problem and solution. Interest in new, unknown, and complexity. Motivation.' },
            { key: 'originality', label: 'Originality of Concept', description: 'Novelty in approach. Creativity and Innovation in thinking. Creativity in whole approach.' },
            { key: 'description', label: 'Description of Concepts', description: 'How well did the team understand the problem? Connection to UN SDGs. Research and Analysis.' },
            { key: 'viability', label: 'Viability of Concept', description: 'How well did the team think over their solution? Research and Analysis of Solution. Effectiveness.' },
            { key: 'design', label: 'Description of Design', description: 'How much solution is actually done? Knowledge of Software/Hardware. Future Scope.' },
            { key: 'delivery', label: 'Delivery/Presentation', description: 'Presented in a holistic way? Creativity in presentation. Confidence while answering.' }
        ]
    },
    subscription: {
        plan: { type: String, enum: ['free', 'plus', 'ultra'], default: 'free' },
        paymentId: String,
        orderId: String,
        paidAt: Date
    }
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    team: { type: String, trim: true },
    school: { type: String, trim: true },
    contact: { type: String, trim: true }
}, { timestamps: true });

const EvaluatorSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    expertise: { type: String, trim: true },
    notes: { type: String, trim: true },
    code: { type: String, required: true }
}, { timestamps: true });

const PanelSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    evaluatorIds: [{ type: String }],
    projectIds: [{ type: String }]
}, { timestamps: true });

const ResultSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    panelId: { type: String },
    projectId: { type: String, required: true },
    evaluatorId: { type: String, required: true },
    scores: { type: Map, of: Number },
    remark: { type: String, trim: true },
    total: { type: Number, min: 0 },
    ts: { type: Date, default: Date.now },
    finalizedByEvaluator: { type: Boolean, default: false }
}, { timestamps: true });

const EvaluatorStateSchema = new mongoose.Schema({
    evaluatorId: { type: String, unique: true, required: true },
    finalizedAll: { type: Boolean, default: false }
}, { timestamps: true });

// Add indexes for better performance
ProjectSchema.index({ title: 1 });
EvaluatorSchema.index({ name: 1 });
PanelSchema.index({ name: 1 });
ResultSchema.index({ ts: 1 });

module.exports = {
    Setting: mongoose.model('Setting', SettingSchema),
    Project: mongoose.model('Project', ProjectSchema),
    Evaluator: mongoose.model('Evaluator', EvaluatorSchema),
    Panel: mongoose.model('Panel', PanelSchema),
    Result: mongoose.model('Result', ResultSchema),
    EvaluatorState: mongoose.model('EvaluatorState', EvaluatorStateSchema)
};
