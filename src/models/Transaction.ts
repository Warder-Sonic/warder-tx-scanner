import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  timestamp: Date;
  gasUsed?: string;
  gasPrice?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenAmount?: string;
  dexName?: string;
  swapType?: 'buy' | 'sell' | 'transfer';
  processed: boolean;
  cashbackAmount?: string;
  cashbackRate?: number;
  treasuryTxHash?: string;
  processedAt?: Date;
}

const TransactionSchema: Schema = new Schema({
  hash: { type: String, required: true, unique: true, index: true },
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  value: { type: String, required: true },
  blockNumber: { type: Number, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  gasUsed: { type: String },
  gasPrice: { type: String },
  contractAddress: { type: String, index: true },
  tokenSymbol: { type: String },
  tokenAmount: { type: String },
  dexName: { type: String, index: true },
  swapType: { type: String, enum: ['buy', 'sell', 'transfer'] },
  processed: { type: Boolean, default: false, index: true },
  cashbackAmount: { type: String },
  cashbackRate: { type: Number },
  treasuryTxHash: { type: String },
  processedAt: { type: Date }
}, {
  timestamps: true
});

TransactionSchema.index({ blockNumber: 1, timestamp: 1 });
TransactionSchema.index({ processed: 1, dexName: 1 });
TransactionSchema.index({ from: 1, processed: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);