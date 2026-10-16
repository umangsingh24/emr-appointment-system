import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    // Human-friendly identifier shown at the front desk, e.g. "PT-000042".
    patientCode: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Lower-cased copy so prefix searches (/^ram/) can use a plain B-tree index.
    searchName: { type: String, required: true, select: false },
    // Not unique: family members commonly share one phone number.
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
    address: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        delete ret.searchName;
        return ret;
      },
    },
  },
);

patientSchema.pre('validate', function setSearchName() {
  if (this.name) this.searchName = this.name.toLowerCase();
});

patientSchema.index({ patientCode: 1 }, { unique: true });
patientSchema.index({ mobile: 1 });
patientSchema.index({ searchName: 1 });

export const Patient = mongoose.model('Patient', patientSchema);
