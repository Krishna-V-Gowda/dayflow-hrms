from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..db import get_db
from ..models import Notification, User
from ..schemas import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50).all()


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def read_notification(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not item:
        raise HTTPException(404, "Notification not found")
    item.is_read = True
    db.commit()
    db.refresh(item)
    return item