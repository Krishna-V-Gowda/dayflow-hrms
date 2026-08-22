from __future__ import annotations

import json
from sqlalchemy.orm import Session
from .models import AuditLog, Notification, User


def audit(db: Session, actor: User, action: str, entity_type: str, entity_id: int, details: dict):
    db.add(AuditLog(
        actor_user_id=actor.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details, default=str),
    ))


def notify(db: Session, user_id: int, title: str, message: str, notification_type: str = "leave"):
    db.add(Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
    ))