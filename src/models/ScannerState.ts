import mongoose, { Schema, Document } from 'mongoose';

export interface IScannerState extends Document {
  name: string;
  lastScannedBlock: number;
  totalTransactionsProcessed: number;
  totalCashbackPaid: string;
  lastScanTime: Date;
  isActive: boolean;
}

const ScannerStateSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  lastScannedBlock: { type: Number, required: true, default: 0 },
  totalTransactionsProcessed: { type: Number, default: 0 },
  totalCashbackPaid: { type: String, default: '0' },
  lastScanTime: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model<IScannerState>('ScannerState', ScannerStateSchema);