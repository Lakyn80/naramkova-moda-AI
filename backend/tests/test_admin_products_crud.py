from __future__ import annotations

import io

from app.db.models import Category


def _create_category(db_session):
    cat = Category(name="Test", slug="test", group="Skupina")
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)
    return cat


def test_create_product(client, db_session):
    cat = _create_category(db_session)
    data = {
        "name": "Produkt A",
        "description": "Popis",
        "price_czk": "199",
        "stock": "3",
        "category_id": str(cat.id),
    }
    files = {
        "image": ("test.jpg", io.BytesIO(b"fake"), "image/jpeg")
    }
    response = client.post("/api/products/", data=data, files=files)
    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Produkt A"
    assert payload["price"] == 199.0


def test_update_product(client, db_session):
    cat = _create_category(db_session)
    create = client.post(
        "/api/products/",
        data={
            "name": "Produkt B",
            "price": "149",
            "stock": "1",
            "category_id": str(cat.id),
        },
    )
    product_id = create.json()["id"]

    response = client.put(f"/api/products/{product_id}", json={"name": "Produkt C"})
    assert response.status_code == 200
    assert response.json()["name"] == "Produkt C"


def test_delete_product(client, db_session):
    cat = _create_category(db_session)
    create = client.post(
        "/api/products/",
        data={
            "name": "Produkt D",
            "price": "99",
            "stock": "1",
            "category_id": str(cat.id),
        },
    )
    product_id = create.json()["id"]

    response = client.delete(f"/api/products/{product_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Deleted"

    get_resp = client.get(f"/api/products/{product_id}")
    assert get_resp.status_code == 404

