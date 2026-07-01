import { ChatAutoAssignService } from './chat-auto-assign.service';
import { ChatService } from './chat.service';
import { CHAT_AUTO_ASSIGN_JOB } from './chat.types';

describe('ChatAutoAssignService', () => {
  it('delegates auto-assign jobs to ChatService', async () => {
    const chat = { performAutoAssign: jest.fn().mockResolvedValue(undefined) };
    const queue = { register: jest.fn() };
    const service = new ChatAutoAssignService(queue as never, chat as unknown as ChatService);

    service.onModuleInit();
    expect(queue.register).toHaveBeenCalled();

    const handler = queue.register.mock.calls[0][1];
    await handler({
      name: CHAT_AUTO_ASSIGN_JOB,
      data: { tenantId: 't1', conversationId: 'conv-1' },
    });

    expect(chat.performAutoAssign).toHaveBeenCalledWith('t1', 'conv-1');
  });
});
