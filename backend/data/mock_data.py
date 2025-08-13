# backend/data/mock_data.py
"""
Тестові дані для першого запуску
"""

mock_archives_list = [
    {
        "code": "ARCH001",
        "title": {
            "ua": "Меблі для вітальні",
            "en": "Living Room Furniture",
            "ru": "Мебель для гостиной"
        },
        "description": {
            "ua": "Колекція сучасних меблів для вітальні включає дивани, крісла, столики",
            "en": "Modern living room furniture collection includes sofas, chairs, tables",
            "ru": "Коллекция современной мебели для гостиной включает диваны, кресла, столики"
        },
        "price": 29.99,
        "discount_percent": 10,
        "archive_type": "premium",
        "category": "Furniture",
        "tags": ["furniture", "living room", "modern"],
        "image_paths": ["images/furniture/living_room_1.jpg"],
        "file_size": 125000000,  # 125 MB
        "file_count": 45,
        "version": "2024.1",
        "is_active": True,
        "view_count": 150,
        "download_count": 25,
        "rating": 4.5,
        "ratings_count": 12
    },
    {
        "code": "ARCH002",
        "title": {
            "ua": "Кухонні меблі",
            "en": "Kitchen Furniture",
            "ru": "Кухонная мебель"
        },
        "description": {
            "ua": "Повний набір кухонних меблів з різними варіантами конфігурації",
            "en": "Complete kitchen furniture set with various configuration options",
            "ru": "Полный набор кухонной мебели с различными вариантами конфигурации"
        },
        "price": 39.99,
        "discount_percent": 15,
        "archive_type": "premium",
        "category": "Furniture",
        "tags": ["furniture", "kitchen", "cabinets"],
        "image_paths": ["images/furniture/kitchen_1.jpg"],
        "file_size": 185000000,  # 185 MB
        "file_count": 62,
        "version": "2024.1",
        "is_active": True,
        "view_count": 230,
        "download_count": 45,
        "rating": 4.7,
        "ratings_count": 18
    },
    {
        "code": "ARCH003",
        "title": {
            "ua": "Офісні меблі",
            "en": "Office Furniture",
            "ru": "Офисная мебель"
        },
        "description": {
            "ua": "Ергономічні офісні меблі для продуктивної роботи",
            "en": "Ergonomic office furniture for productive work",
            "ru": "Эргономичная офисная мебель для продуктивной работы"
        },
        "price": 34.99,
        "discount_percent": 20,
        "archive_type": "premium",
        "category": "Furniture",
        "tags": ["furniture", "office", "desk", "ergonomic"],
        "image_paths": ["images/furniture/office_1.jpg"],
        "file_size": 95000000,  # 95 MB
        "file_count": 38,
        "version": "2024.1",
        "is_active": True,
        "view_count": 180,
        "download_count": 32,
        "rating": 4.6,
        "ratings_count": 15
    },
    {
        "code": "ARCH004",
        "title": {
            "ua": "Двері та вікна",
            "en": "Doors and Windows",
            "ru": "Двери и окна"
        },
        "description": {
            "ua": "Великий вибір дверей та вікон різних стилів",
            "en": "Large selection of doors and windows in various styles",
            "ru": "Большой выбор дверей и окон различных стилей"
        },
        "price": 24.99,
        "discount_percent": 0,
        "archive_type": "premium",
        "category": "Architecture",
        "tags": ["doors", "windows", "architecture"],
        "image_paths": ["images/architecture/doors_windows_1.jpg"],
        "file_size": 78000000,  # 78 MB
        "file_count": 52,
        "version": "2024.1",
        "is_active": True,
        "view_count": 120,
        "download_count": 18,
        "rating": 4.4,
        "ratings_count": 9
    },
    {
        "code": "FREE001",
        "title": {
            "ua": "Базові стільці",
            "en": "Basic Chairs",
            "ru": "Базовые стулья"
        },
        "description": {
            "ua": "Безкоштовна колекція базових стільців",
            "en": "Free collection of basic chairs",
            "ru": "Бесплатная коллекция базовых стульев"
        },
        "price": 0,
        "discount_percent": 0,
        "archive_type": "free",
        "category": "Furniture",
        "tags": ["furniture", "chairs", "free"],
        "image_paths": ["images/furniture/chairs_free.jpg"],
        "file_size": 15000000,  # 15 MB
        "file_count": 8,
        "version": "2024.1",
        "is_active": True,
        "view_count": 450,
        "download_count": 120,
        "rating": 4.2,
        "ratings_count": 25
    },
    {
        "code": "ARCH005",
        "title": {
            "ua": "Ванна кімната",
            "en": "Bathroom",
            "ru": "Ванная комната"
        },
        "description": {
            "ua": "Сучасні рішення для ванної кімнати",
            "en": "Modern bathroom solutions",
            "ru": "Современные решения для ванной комнаты"
        },
        "price": 27.99,
        "discount_percent": 5,
        "archive_type": "premium",
        "category": "Plumbing",
        "tags": ["bathroom", "plumbing", "modern"],
        "image_paths": ["images/plumbing/bathroom_1.jpg"],
        "file_size": 68000000,  # 68 MB
        "file_count": 35,
        "version": "2024.1",
        "is_active": True,
        "view_count": 95,
        "download_count": 15,
        "rating": 4.8,
        "ratings_count": 11
    }
]