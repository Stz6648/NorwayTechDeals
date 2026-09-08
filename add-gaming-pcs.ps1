$products = Get-Content "products.json" -Raw | ConvertFrom-Json

$newProducts = @(
    @{
        id = "lenovo-loq-17irr9-rtx3050"
        brand = "Lenovo"
        name = "Lenovo LOQ 17IRR9 Gaming Desktop"
        model = "17IRR9"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "Lenovo LOQ gaming desktop with Intel Core i5 processor, NVIDIA GeForce RTX 3050 graphics, 8GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 3050"
        vram = "6 GB"
        specifications = @{
            cpu = "Intel Core i5-14400"
            gpu = "NVIDIA GeForce RTX 3050"
            ram = "8 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "6 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 14995
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/product/pc-datautstyr-og-kontor/pc/stasjonar-pc/lenovo-loq-17irr9-i5-1481tb3050-gaming-desktop/913582"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 14995
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    },
    @{
        id = "asus-tuf-t500-rtx5060"
        brand = "ASUS"
        name = "ASUS TUF T500 Gaming Desktop RTX 5060"
        model = "T500"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "ASUS TUF gaming desktop with Intel Core 5 processor, RTX 5060 graphics, 16GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 5060"
        vram = "8 GB"
        specifications = @{
            cpu = "Intel Core 5 210H"
            gpu = "NVIDIA GeForce RTX 5060"
            ram = "16 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "8 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 18495
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 18495
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    },
    @{
        id = "lenovo-legion-t5-rtx5060ti"
        brand = "Lenovo"
        name = "Lenovo Legion T5 Gaming Desktop RTX 5060 Ti"
        model = "Legion T5"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "Lenovo Legion T5 gaming desktop with AMD Ryzen processor, RTX 5060 Ti graphics, 16GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 5060 Ti"
        vram = "16 GB"
        specifications = @{
            cpu = "AMD Ryzen 5 7600"
            gpu = "NVIDIA GeForce RTX 5060 Ti"
            ram = "16 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "16 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 19995
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 19995
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    },
    @{
        id = "hp-omen-35l-rtx5060ti"
        brand = "HP"
        name = "HP OMEN 35L Gaming Desktop RTX 5060 Ti"
        model = "OMEN 35L"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "HP OMEN 35L gaming desktop with Intel Core i5 processor, RTX 5060 Ti graphics, 16GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 5060 Ti"
        vram = "16 GB"
        specifications = @{
            cpu = "Intel Core i5-14400F"
            gpu = "NVIDIA GeForce RTX 5060 Ti"
            ram = "16 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "16 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 19995
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 19995
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    },
    @{
        id = "lenovo-legion-tower-5i-rtx5060ti"
        brand = "Lenovo"
        name = "Lenovo Legion Tower 5i Gaming Desktop RTX 5060 Ti"
        model = "Legion Tower 5i"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "Lenovo Legion Tower 5i gaming desktop with Intel Core Ultra processor, RTX 5060 Ti graphics, 16GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 5060 Ti"
        vram = "16 GB"
        specifications = @{
            cpu = "Intel Core Ultra 7 265"
            gpu = "NVIDIA GeForce RTX 5060 Ti"
            ram = "16 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "16 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 22995
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 22995
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    },
    @{
        id = "pcspecialist-prime-400-rtx5070"
        brand = "PCSpecialist"
        name = "PCSpecialist Prime 400 Gaming Desktop RTX 5070"
        model = "Prime 400"
        category = "Gaming PC"
        subcategory = "Gaming Desktop"
        condition = "New"
        image = "/images/gaming-pc.jpg"
        description = "PCSpecialist Prime 400 gaming desktop with Intel Core i7 processor, RTX 5070 graphics, 16GB RAM and 1TB SSD."
        gpu = "NVIDIA GeForce RTX 5070"
        vram = "12 GB"
        specifications = @{
            cpu = "Intel Core i7-14700F"
            gpu = "NVIDIA GeForce RTX 5070"
            ram = "16 GB"
            storage = "1 TB SSD"
            screen = ""
            vram = "12 GB"
        }
        offers = @(
            @{
                store = "Elkjøp"
                country = "NO"
                condition = "New"
                price = 24995
                currency = "NOK"
                shipping = $null
                inStock = $true
                affiliate = $null
                affiliateNetwork = $null
                url = "https://www.elkjop.no/"
                updatedAt = "2026-09-08"
            }
        )
        lowestPrice = 24995
        lowestStore = "Elkjøp"
        updatedAt = "2026-09-08"
    }
)

$products = @($products) + $newProducts

$json = $products | ConvertTo-Json -Depth 10

Set-Content "products.json" $json -Encoding UTF8
Set-Content "public\products.json" $json -Encoding UTF8

Write-Host "Gaming PCs added successfully."