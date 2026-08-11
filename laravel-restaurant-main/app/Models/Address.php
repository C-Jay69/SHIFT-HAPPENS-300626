<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;    

class Address extends Model
{
    use HasFactory;
    use SoftDeletes;                            

    protected $fillable = [
        'user_id',
        'label',
        'street',
        'city',
        'state',
        'postal_code',
        'country',
        'latitude',
        'longitude',
        'is_default',
    ];

    // Relationship: each address belongs to a user
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getFullAddressAttribute()
    {
        $parts = array_filter([
            $this->street,
            $this->city,
            $this->state,
            $this->postal_code,
        ]);

        return implode(', ', $parts);
    }
}
