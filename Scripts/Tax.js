const STATIC_IP = "https://localhost:44324";


$(document).ready(() => {

    init();

    $("#btnClear").click(() => { reload(); });

    $("#btnCalculate").click(() => {
        (async () => {
            let sub = {
                lineItems: dataDTO.lineItems,
                amount: dataDTO.amount,
                shipping: $("#shipping-box").val(),
            }

            await onSubmit(dataDTO.selectedCustomerId, sub)
                .then((resp) => {
                    if (resp !== undefined && resp.success) displayTaxInfo(resp.response);
                });

        })();
    });
});

let dataDTO = {
    products: null,
    customers: null,
    selectedCustomerId: null,
    lineItems: [],
    amount: 0,
};

const init = async () => {
    let sub = {
        customers: null,
        products: null,
    }
    await loadCustomers()
        .then(resp => {
            if (resp.success) sub.customers = resp.response;
        });

    await loadProducts()
        .then(resp => {
            if (resp.success) sub.products = resp.response;
        });

    if (sub.customers != null && sub.products != null) {
        drawCustomersDiv(sub);
        drawProducts(sub);
    }
};

const drawCustomersDiv = (submission) => {
    submission.customers.map((cu, index) => {
        let address = cu.street + " " + cu.city + ", " + cu.state + " " + cu.country + "  " + cu.zipCode
        $("#customer-div").append(`
                    <tr >
                        <td>
                            <input name="customers" type="radio" id="${cu.id}" value="${cu.id}" onClick="onSelectRadioButton('${cu.id}')" />
                        </td>
                        <td>${cu.name}</td>
                        <td>${address}</td>
                    </tr>
        `);
    });
}

const drawProducts = (submission) => {
    submission.products.map((prod, index) => {
        $("#products-div").append(`
            <tr>
                <td>${prod.name}</td>
                <td>$ ${prod.price}</td>
                <td>
                    <input onkeypress="return validateNumber(event)" id="prod_${prod.id}" class="text-box" placeholder="Quantity"  type="text" onchange="onTextBoxChange('${prod.name}')"
                    value="0"
                    />
                </td>
                <td><label  id="prod_result_${prod.id}">$ 0</label></td>
                <td><label  id="prod_tax_${prod.id}">$ 0</label></td>
                <td><label  id="prod_net_${prod.id}">$ 0</label></td>
            </tr>
        `);
    });
    $("#products-div").append(`
        <tr>
            <td><b>Shipping</b></td>
            <td></td>
            <td>
            <input onkeypress="return validateNumber(event)" name="shipping" style="background-color: #f1c677;" class="text-box" placeholder="Shipping" type="text" id="shipping-box" value="0" />
            </td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    `);
}

const validateNumber = (e) => {
    return e.keyCode >= 46 && e.keyCode <= 57;
}

const onSelectRadioButton = (customerId) => {
    dataDTO.selectedCustomerId = customerId;
}
const onTextBoxChange = () => {
    let values = [];
    let totalPrice = 0;

    for (let i = 1; i <= dataDTO.products.length; i++) {
        let prod = dataDTO.products[i - 1];
        let qty = $(`#prod_${i}`).val();
        values.push({
            id: i,
            quantity: qty,
            unit_price: prod.price,
        });
        let result = rounding(qty * prod.price);

        totalPrice += Math.round((result) * 10000) / 10000;
    }

    dataDTO.lineItems = values;
    dataDTO.amount = totalPrice;

}

const onSubmit = async (id, submission) => {
    if (id == null || id === undefined) {
        displayAlert(false, "user id can not be null!");
        return;
    };
    const url = `${STATIC_IP}/api/tax/${id}`;

    let callback = {
        success: false,
        response: null,
    };

    await fetch(url, {
        method: "PUT",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            amount: submission.amount,
            shipping: submission.shipping,
            lineItems: submission.lineItems,
        }),
    })
        .then((response) => {
            switch (response.status) {
                case 200:
                    callback.success = true;
                    return response.json();
                    break;
                case 400:
                    console.log("Bad Request – Your request format is bad.");
                    break;
                case 401:
                    console.log("Unauthorized – Your API key is wrong.");
                    break;
                case 403:
                    console.log("Forbidden – The resource requested is not authorized for use.");
                    break;
                case 404:
                    console.log("Not Found – The specified resource could not be found.");
                    break;
                case 405:
                    console.log("Method Not Allowed – You tried to access a resource with an invalid method");
                    break;
                case 406:
                    console.log("Not Acceptable – Your request is not acceptable.");
                    break;
                case 410:
                    console.log("Gone – The resource requested has been removed from our servers.");
                    break;
                case 422:
                    console.log("Unprocessable Entity – Your request could not be processed.");
                    break;
                case 429:
                    console.log("Too Many Requests – You’re requesting too many resources! Slow down!");
                    break;
                case 500:
                    console.log("Internal Server Error – We had a problem with our server. Try again later.");
                    break;
                case 503:
                    console.log("Service Unavailable – We’re temporarily offline for maintenance. Try again later.");
                    break;
                default:
                    alert(response.status);
                    break;
            }
        })
        .then(responseJson => {
            if (callback.success) callback.response = responseJson
        })
        .catch(error => {
            console.log(error);
        });

    return callback;
};
const displayTaxInfo = (info) => {
    if (info.breakdown == null) {
        displayAlert(false, "No result! Please fill at least one item.");
        return;
    }
    displayAlert(true, "Successful!");

    let responseLineItems = info.breakdown.line_items;

    let totalAfterTax = 0
    let totalBeforeTax = 0
    responseLineItems.map((rli, index) => {
        let afterTax = rli.taxable_amount + rli.tax_collectable;
        $(`#prod_result_${rli.id}`).text("$ " + rounding(rli.taxable_amount));
        $(`#prod_tax_${rli.id}`).text("$ " + rounding(rli.tax_collectable));
        $(`#prod_net_${rli.id}`).text("$ " + rounding(afterTax));

        totalBeforeTax += rli.taxable_amount;
        totalAfterTax += afterTax;
    });

    $('#lblTotalBeforeTax').text("$ " + rounding(totalBeforeTax));
    $('#lblTaxRate').text("% " + (info.rate * 100));
    $('#lblTotalTax').text("$ " + rounding(info.amount_to_collect));
    $('#lblShipping').text("$ " + rounding(info.shipping));
    $('#lblTotalAfterTax').text("$ " + rounding(info.order_total_amount + info.amount_to_collect)).css("font-weight", "bold");

}


const displayAlert = (isSuccess, text) => {
    let alert = $("#customAlertContainer");
    alert.show("slow")

    if (isSuccess) {
        alert.removeClass("alert-danger").addClass("alert-success");
    } else {
        alert.removeClass("alert-success").addClass("alert-danger");
    }

    $("#lblCustomAlert").text(text);
    setTimeout(() => {
        alert.hide("slow");
    }, 4000);
}

const loadCustomers = async () => {
    const url = `${STATIC_IP}/api/customers`;

    let callback = {
        success: false,
        response: null,
    };

    await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            switch (response.status) {
                case 200:
                    callback.success = true;
                    return response.json();
                    break;
                default:
                    alert(response.status);
                    break;
            }
        })
        .then(responseJson => {
            if (callback.success) {
                callback.response = responseJson
                dataDTO.customers = responseJson;
            }
        })
        .catch(error => {
            console.log(error);
        });

    return callback;
};
const loadProducts = async () => {
    const url = `${STATIC_IP}/api/products`;

    let callback = {
        success: false,
        response: null,
    };

    await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            switch (response.status) {
                case 200:
                    callback.success = true;
                    return response.json();
                    break;
                default:
                    alert(response.status);
                    break;
            }
        })
        .then(responseJson => {
            if (callback.success) {
                callback.response = responseJson;
                dataDTO.products = responseJson;
            }
        })
        .catch(error => {
            console.log(error);
        });

    return callback;
};

const rounding = (value) => {
    return Math.round(value * 100) / 100
}

const reload = () => {
    location.reload();
}
