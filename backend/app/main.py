from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging import configure_logging

from app.modules.auth.router import router as auth_router
from app.modules.admin.router import router as admin_router
from app.modules.users.router import router as users_router
from app.modules.products.router import router as products_router
from app.modules.categories.router import router as categories_router
from app.modules.media.router import router as media_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.qr.router import router as qr_router
from app.modules.email.router import router as email_router
from app.modules.invoice.router import router as invoice_router
from app.modules.ai.vision.router import router as ai_vision_router
from app.modules.ai.rag.router import router as ai_rag_router
from app.modules.ai.deepseek.router import router as ai_deepseek_router


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
    )

    # Core modules
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(users_router)
    app.include_router(products_router)
    app.include_router(categories_router)
    app.include_router(media_router)
    app.include_router(orders_router)
    app.include_router(payments_router)
    app.include_router(qr_router)
    app.include_router(email_router)

    # AI modules
    app.include_router(ai_vision_router)
    app.include_router(ai_rag_router)
    app.include_router(ai_deepseek_router)

    # Invoice API is optional and disabled by default
    if settings.expose_invoice_api:
        app.include_router(invoice_router)

    return app


app = create_app()
