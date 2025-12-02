// src/middlewares/groupGuard.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ======================================================
   依 Split ID 驗證：呼叫者必須是該分帳所屬群組成員
   用在：/splits/:id/settle、/splits/:id/participants/:participantId/pay
====================================================== */
export async function requireMemberBySplitParam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const splitId = Number(req.params.id);

    if (!userId || !Number.isFinite(splitId)) {
      return res.status(400).json({ message: '參數錯誤' });
    }

    const split = await prisma.split.findUnique({
      where: { id: splitId },
      select: { groupId: true },
    });
    if (!split) return res.status(404).json({ message: '找不到分帳' });

    const member = await prisma.groupMember.findFirst({
      where: { userId, groupId: split.groupId },
      select: { id: true },
    });
    if (!member) return res.status(403).json({ message: '無權限（非群組成員）' });

    next();
  } catch (err) {
    console.error('[requireMemberBySplitParam] error:', err);
    return res.status(500).json({ message: '伺服器錯誤' });
  }
}

/* ======================================================
   依 groupId 驗證：呼叫者必須是該群組成員
   傳入 getGroupId 函數以靈活取得 groupId（body 或 query）
   用在：建立分帳、查詢分帳
====================================================== */
export function requireMemberByGroup(getGroupId: (req: Request) => number | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const groupId = getGroupId(req);

      if (!userId) {
        return res.status(401).json({ message: '未登入' });
      }

      if (!groupId || !Number.isFinite(groupId)) {
        return res.status(400).json({ message: '缺少或無效的 groupId' });
      }

      const member = await prisma.groupMember.findFirst({
        where: { userId, groupId },
        select: { id: true },
      });

      if (!member) {
        return res.status(403).json({ message: '無權限（非群組成員）' });
      }

      next();
    } catch (err) {
      console.error('[requireMemberByGroup] error:', err);
      return res.status(500).json({ message: '伺服器錯誤' });
    }
  };
}
