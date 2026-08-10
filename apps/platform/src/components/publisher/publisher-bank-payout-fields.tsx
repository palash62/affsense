"use client";

import { COUNTRY_BY_CODE } from "@/lib/campaign-form";
import type { BankPayoutDetails } from "@/lib/payout-payment-details";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EU_IBAN_COUNTRIES = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "IE", "PT", "FI", "GR", "LU"];

type PublisherBankPayoutFieldsProps = {
  value: BankPayoutDetails;
  onChange: (value: BankPayoutDetails) => void;
};

export function PublisherBankPayoutFields({ value, onChange }: PublisherBankPayoutFieldsProps) {
  const country = value.country.toUpperCase();
  const isUS = country === "US";
  const isGB = country === "GB";
  const isIN = country === "IN";
  const needsIban = EU_IBAN_COUNTRIES.includes(country);

  function patch(partial: Partial<BankPayoutDetails>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/60 p-4">
      <p className="text-sm font-medium text-foreground">Bank transfer details</p>

      <div className="space-y-2">
        <Label>Country</Label>
        <Select
          value={value.country}
          onValueChange={(v) => v && patch({ country: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COUNTRY_BY_CODE)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Beneficiary name</Label>
        <Input
          value={value.beneficiaryName}
          onChange={(e) => patch({ beneficiaryName: e.target.value })}
          placeholder="Full name on account"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Account number</Label>
        <Input
          value={value.accountNumber}
          onChange={(e) => patch({ accountNumber: e.target.value })}
          required
        />
      </div>

      {(isUS || isIN) && (
        <div className="space-y-2">
          <Label>{isIN ? "IFSC code" : "Routing number"}</Label>
          <Input
            value={value.routingNumber ?? ""}
            onChange={(e) => patch({ routingNumber: e.target.value })}
            required
          />
        </div>
      )}

      {isGB && (
        <div className="space-y-2">
          <Label>Sort code</Label>
          <Input
            value={value.sortCode ?? ""}
            onChange={(e) => patch({ sortCode: e.target.value })}
            placeholder="12-34-56"
            required
          />
        </div>
      )}

      {needsIban && (
        <div className="space-y-2">
          <Label>IBAN</Label>
          <Input
            value={value.iban ?? ""}
            onChange={(e) => patch({ iban: e.target.value })}
            required
          />
        </div>
      )}

      {!isUS && !isGB && !isIN && !needsIban && value.country && (
        <>
          <div className="space-y-2">
            <Label>IBAN (if applicable)</Label>
            <Input
              value={value.iban ?? ""}
              onChange={(e) => patch({ iban: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>SWIFT / BIC</Label>
            <Input
              value={value.swiftBic ?? ""}
              onChange={(e) => patch({ swiftBic: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Bank name</Label>
        <Input
          value={value.bankName ?? ""}
          onChange={(e) => patch({ bankName: e.target.value })}
        />
      </div>

      {(isUS || value.country) && (
        <div className="space-y-2">
          <Label>Account type</Label>
          <Select
            value={value.accountType ?? ""}
            onValueChange={(v) => v && patch({ accountType: v as BankPayoutDetails["accountType"] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Address line</Label>
          <Input
            value={value.addressLine1 ?? ""}
            onChange={(e) => patch({ addressLine1: e.target.value })}
            required={isUS}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={value.city ?? ""}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>State / Province</Label>
          <Input
            value={value.state ?? ""}
            onChange={(e) => patch({ state: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Postal code</Label>
          <Input
            value={value.postalCode ?? ""}
            onChange={(e) => patch({ postalCode: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Bank address (optional)</Label>
        <Input
          value={value.bankAddress ?? ""}
          onChange={(e) => patch({ bankAddress: e.target.value })}
        />
      </div>
    </div>
  );
}

export const EMPTY_BANK_DETAILS: BankPayoutDetails = {
  country: "",
  beneficiaryName: "",
  accountNumber: "",
};
