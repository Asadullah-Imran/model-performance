import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ModelModel, ExperimentRunModel } from '@/models/Experiment';

export async function POST(request: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json(
        { error: 'Could not connect to MongoDB. Please check MONGO_URI in .env.' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Supports single run or array of runs
    const payloadArray = Array.isArray(body) ? body : [body];
    const savedRuns = [];

    for (const item of payloadArray) {
      const {
        modelId,
        modelName,
        datasetId,
        datasetName,
        seed,
        bestEpoch,
        bestScore,
        durationSeconds,
        finalMetrics,
        history,
        visualizations,
        embeddingsData,
        embeddings,
        modelMetadata,
      } = item;

      if (!modelId || !datasetId || seed === undefined || !finalMetrics) {
        return NextResponse.json(
          { error: 'Missing required fields: modelId, datasetId, seed, and finalMetrics are required.' },
          { status: 400 }
        );
      }

      // Upsert Model if metadata is provided
      if (modelMetadata || modelName) {
        await ModelModel.findOneAndUpdate(
          { id: modelId },
          {
            id: modelId,
            name: modelName || modelId,
            version: modelMetadata?.version || 'v1.0',
            description: modelMetadata?.description || '',
            architecture: modelMetadata?.architecture || 'Custom Model',
            numParameters: modelMetadata?.numParameters,
            hyperparameters: modelMetadata?.hyperparameters || {},
            ...(modelMetadata?.colorTheme ? { colorTheme: modelMetadata.colorTheme } : {}),
          },
          { upsert: true, new: true }
        );
      }

      // Upsert Experiment Run (prevents duplicate runs for same model+dataset+seed)
      const run = await ExperimentRunModel.findOneAndUpdate(
        { modelId, datasetId, seed },
        {
          modelId,
          modelName: modelName || modelId,
          datasetId,
          datasetName: datasetName || datasetId,
          seed,
          bestEpoch: bestEpoch || 0,
          bestScore,
          durationSeconds,
          finalMetrics,
          history: history || [],
          visualizations: visualizations || {},
          embeddingsData: embeddingsData || embeddings || {},
        },
        { upsert: true, new: true }
      );

      savedRuns.push(run);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully stored ${savedRuns.length} experiment run(s) in MongoDB.`,
      savedCount: savedRuns.length,
    });
  } catch (error: any) {
    console.error('API /api/experiments/upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while saving experiment data.' },
      { status: 500 }
    );
  }
}
