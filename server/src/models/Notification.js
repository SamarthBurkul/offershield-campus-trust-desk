'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const NOTIFICATION_TYPES = Object.freeze([
  'case_info_requested',
  'case_staff_message',
  'case_decision',
  'case_reopened',
  'case_submitted',
  'case_student_reply',
  'case_assigned',
  'case_recommendation',
  'advisory_published',
]);

const NOTIFICATION_TTL_SECONDS = 180 * 24 * 60 * 60;

// In-app notification. Title and body are rendered only from services/notifications/templates.js.
const notificationSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 300 },
    // Internal app path only (never an absolute or protocol-relative URL).
    link: { type: String, required: true, maxlength: 200, match: /^\/(?!\/)[A-Za-z0-9/_-]*$/ },
    refType: { type: String, enum: ['case', 'advisory'], required: true },
    refId: { type: ObjectId, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ collegeId: 1, userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES, NOTIFICATION_TTL_SECONDS };
