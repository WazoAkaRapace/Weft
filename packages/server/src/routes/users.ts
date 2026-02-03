import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { auth } from '../lib/auth.js';

/**
 * GET /api/user/settings
 * Fetch current user settings
 */
export async function handleGetUserSettings(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userSettings = await db
      .select({
        preferredLanguage: users.preferredLanguage,
        transcriptionModel: users.transcriptionModel,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (userSettings.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return Response.json({
      preferredLanguage: userSettings[0].preferredLanguage || 'en',
      transcriptionModel: userSettings[0].transcriptionModel || 'Xenova/whisper-small',
      email: userSettings[0].email,
      name: userSettings[0].name,
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings
 * Update user settings (language and model)
 */
export async function handleUpdateUserSettings(request: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as {
      preferredLanguage?: string;
      transcriptionModel?: string;
    };

    // Validate language code
    const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no', 'fi', 'auto'];
    if (body.preferredLanguage && !validLanguages.includes(body.preferredLanguage)) {
      return Response.json(
        { error: 'Invalid language', message: 'Language code is not supported' },
        { status: 400 }
      );
    }

    // Validate transcription model
    const validModels = [
      'Xenova/whisper-tiny',
      'Xenova/whisper-tiny.en',
      'Xenova/whisper-base',
      'Xenova/whisper-base.en',
      'Xenova/whisper-small',
      'Xenova/whisper-small.en',
      'Xenova/whisper-medium',
      'Xenova/whisper-medium.en',
      'Xenova/whisper-large',
      'Xenova/whisper-large-v2',
      'Xenova/whisper-large-v3',
    ];
    if (body.transcriptionModel && !validModels.includes(body.transcriptionModel)) {
      return Response.json(
        { error: 'Invalid model', message: 'Transcription model is not supported' },
        { status: 400 }
      );
    }

    // Update user settings
    const updateData: Record<string, string> = {};
    if (body.preferredLanguage) updateData.preferredLanguage = body.preferredLanguage;
    if (body.transcriptionModel) updateData.transcriptionModel = body.transcriptionModel;

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    return Response.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
